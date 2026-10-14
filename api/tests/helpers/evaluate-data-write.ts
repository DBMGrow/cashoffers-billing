import type { CompiledQuery } from "kysely"

/**
 * Evaluates the `data` assignment of a captured `update Subscriptions` statement the way MySQL
 * would, against one stored row, and returns the document the row would hold afterwards. The trial
 * rules (Desk #1350, D1 and D5) are decided by MySQL inside the statement, so a test that only reads
 * the SQL text cannot say what a row ends up with; this can.
 *
 * It understands the subset of MySQL the trial rules use and nothing more: CASE WHEN, AND, NOT, `=`,
 * IS [NOT] NULL, BETWEEN, COALESCE, IF, JSON_TYPE, JSON_EXTRACT, JSON_UNQUOTE, JSON_SET, JSON_MERGE_PATCH, string
 * literals, `?` parameters, the stored `Subscriptions.data`, and the conversion guard (an EXISTS
 * over PurchaseRequests, answered by `stored.converted`). Anything else throws, so a rule written
 * with something new fails loudly rather than evaluating wrong. Real MySQL is the staging check.
 */
export function evaluateDataWrite(
  query: CompiledQuery,
  stored: { data: unknown; converted?: boolean }
): Record<string, unknown> | null {
  const marker = "`data` = "
  const at = query.sql.indexOf(marker)
  if (at < 0) throw new Error("the statement does not write `data`")
  const firstParam = (query.sql.slice(0, at).match(/\?/g) ?? []).length
  const text = query.sql.slice(at + marker.length).replace(CONVERSION_GUARD, " __CONVERTED__ ")
  const parser = new Parser(tokenize(text), query.parameters.slice(firstParam), stored)
  const value = parser.expression()
  const next = parser.peek()
  if (next && next !== "," && next.toLowerCase() !== "where") throw new Error(`unexpected token after data: ${next}`)
  return toDocument(value) as Record<string, unknown> | null
}

/**
 * Evaluates one SQL condition from the same subset (for example the trial-marker test a query's
 * WHERE starts with) against one stored row. Returns true, false or null (SQL NULL).
 */
export function evaluateCondition(
  text: string,
  stored: { data: unknown; converted?: boolean },
  params: readonly unknown[] = []
): boolean | null {
  const parser = new Parser(tokenize(text.replace(CONVERSION_GUARD, " __CONVERTED__ ")), params, stored)
  const value = parser.expression()
  if (parser.peek() !== undefined) throw new Error(`unexpected token after condition: ${parser.peek()}`)
  return value === null ? null : truthy(value)
}

const CONVERSION_GUARD =
  /EXISTS \(SELECT 1 FROM PurchaseRequests AS trial_pr WHERE trial_pr\.subscription_id = Subscriptions\.subscription_id AND trial_pr\.request_type = 'RENEWAL' AND \(\(trial_pr\.status = 'COMPLETED' AND trial_pr\.amount_charged > 0\) OR trial_pr\.status IN \('CREATING_SUBSCRIPTION', 'FINALIZING'\)\)\)/g

/** A JSON value, as opposed to an SQL string. */
class Json {
  constructor(readonly v: unknown) {}
}
type Value = Json | string | boolean | number | null | Date

const PARAM = Symbol("param")
type Token = string | { [PARAM]: true } | { literal: string }

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (/\s/.test(c)) {
      i++
    } else if (c === "?") {
      tokens.push({ [PARAM]: true })
      i++
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1)
      tokens.push({ literal: text.slice(i + 1, end) })
      i = end + 1
    } else if (c === "`") {
      const m = /^`[^`]+`(\.`[^`]+`)*/.exec(text.slice(i))!
      tokens.push(m[0].replace(/`/g, ""))
      i += m[0].length
    } else if ("(),=".includes(c)) {
      tokens.push(c)
      i++
    } else {
      const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(text.slice(i))
      if (!m) throw new Error(`cannot tokenize at: ${text.slice(i, i + 20)}`)
      tokens.push(m[0])
      i += m[0].length
    }
  }
  return tokens
}

class Parser {
  private pos = 0
  private param = 0
  constructor(
    private tokens: Token[],
    private params: readonly unknown[],
    private stored: { data: unknown; converted?: boolean }
  ) {}

  peek(): string | undefined {
    const t = this.tokens[this.pos]
    return typeof t === "string" ? t : t === undefined ? undefined : "<value>"
  }

  private take(expected?: string): Token {
    const t = this.tokens[this.pos++]
    if (expected !== undefined && (typeof t !== "string" || t.toUpperCase() !== expected)) {
      throw new Error(`expected ${expected}, got ${typeof t === "string" ? t : "<value>"}`)
    }
    return t
  }

  private isWord(word: string) {
    const t = this.tokens[this.pos]
    return typeof t === "string" && t.toUpperCase() === word
  }

  expression(): Value {
    let left = this.negation()
    while (this.isWord("AND")) {
      this.take()
      const right = this.negation()
      left = and(left, right)
    }
    return left
  }

  private negation(): Value {
    if (this.isWord("NOT")) {
      this.take()
      const v = this.negation()
      return v === null ? null : !truthy(v)
    }
    return this.comparison()
  }

  private comparison(): Value {
    const left = this.primary()
    if (this.isWord("IS")) {
      this.take()
      const negated = this.isWord("NOT")
      if (negated) this.take()
      this.take("NULL")
      return negated ? left !== null : left === null
    }
    if (this.tokens[this.pos] === "=") {
      this.take()
      const right = this.primary()
      if (left === null || right === null) return null
      return String(sqlScalar(left)) === String(sqlScalar(right))
    }
    if (this.isWord("BETWEEN")) {
      this.take()
      const low = this.primary()
      this.take("AND")
      const high = this.primary()
      if (left === null || low === null || high === null) return null
      const v = String(sqlScalar(left))
      return v >= String(sqlScalar(low)) && v <= String(sqlScalar(high))
    }
    return left
  }

  private primary(): Value {
    const t = this.take()
    if (typeof t === "object" && PARAM in t) return toValue(this.params[this.param++])
    if (typeof t === "object") return t.literal
    if (t === "(") {
      const v = this.expression()
      this.take(")")
      return v
    }
    const word = t.toUpperCase()
    if (word === "FALSE") return false
    if (word === "TRUE") return true
    if (word === "NULL") return null
    if (word === "__CONVERTED__") return !!this.stored.converted
    if (t === "Subscriptions.data") return toJson(this.stored.data)
    if (word === "CASE") {
      this.take("WHEN")
      const cond = this.expression()
      this.take("THEN")
      const yes = this.expression()
      this.take("ELSE")
      const no = this.expression()
      this.take("END")
      return cond !== null && truthy(cond) ? yes : no
    }
    if (this.tokens[this.pos] === "(") {
      this.take("(")
      const args: Value[] = []
      if (this.tokens[this.pos] !== ")") {
        args.push(this.expression())
        while (this.tokens[this.pos] === ",") {
          this.take(",")
          args.push(this.expression())
        }
      }
      this.take(")")
      return call(word, args)
    }
    throw new Error(`unsupported token: ${t}`)
  }
}

function toValue(p: unknown): Value {
  if (p === undefined) throw new Error("ran out of parameters")
  if (p === null || typeof p === "string" || typeof p === "number" || typeof p === "boolean" || p instanceof Date)
    return p
  throw new Error(`unsupported parameter: ${String(p)}`)
}

function truthy(v: Value): boolean {
  if (typeof v === "boolean") return v
  if (typeof v === "number") return v !== 0
  throw new Error(`not a condition: ${String(v)}`)
}

function and(a: Value, b: Value): Value {
  if (a === false || b === false) return false
  if (a === null || b === null) return null
  return truthy(a) && truthy(b)
}

/** An SQL argument read as JSON, the way MySQL's JSON functions read a string argument. */
function toJson(v: Value | unknown): Json | null {
  if (v === null || v === undefined) return null
  if (v instanceof Json) return v
  if (typeof v === "string") return new Json(JSON.parse(v))
  if (typeof v === "object") return new Json(v)
  throw new Error(`not a JSON document: ${String(v)}`)
}

function sqlScalar(v: Value): unknown {
  if (v instanceof Json) return typeof v.v === "string" ? v.v : JSON.stringify(v.v)
  return v
}

function toDocument(v: Value): unknown {
  if (v === null) return null
  return structuredClone(toJson(v)!.v)
}

function pathKeys(path: Value): string[] {
  if (typeof path !== "string" || !path.startsWith("$.")) throw new Error(`unsupported path: ${String(path)}`)
  return path.slice(2).split(".")
}

function jsonType(v: unknown): string {
  if (v === null) return "NULL"
  if (typeof v === "string") return "STRING"
  if (typeof v === "boolean") return "BOOLEAN"
  if (typeof v === "number") return Number.isInteger(v) ? "INTEGER" : "DOUBLE"
  if (Array.isArray(v)) return "ARRAY"
  return "OBJECT"
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isObject(patch)) return patch
  const out: Record<string, unknown> = isObject(target) ? { ...target } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k]
    else out[k] = mergePatch(out[k], v)
  }
  return out
}

function call(name: string, args: Value[]): Value {
  switch (name) {
    case "COALESCE":
      return args.find((a) => a !== null) ?? null
    case "IF":
      return args[0] !== null && truthy(args[0]) ? args[1] : args[2]
    case "JSON_TYPE": {
      const j = toJson(args[0])
      return j === null ? null : jsonType(j.v)
    }
    case "JSON_UNQUOTE": {
      const v = args[0]
      if (v === null) return null
      return v instanceof Json ? (sqlScalar(v) as string) : String(v)
    }
    case "JSON_EXTRACT": {
      const j = toJson(args[0])
      if (j === null) return null
      let cur: unknown = j.v
      for (const key of pathKeys(args[1])) {
        if (!isObject(cur) || !(key in cur)) return null
        cur = cur[key]
      }
      return new Json(cur)
    }
    case "JSON_SET": {
      const j = toJson(args[0])
      if (j === null) return null
      const doc = structuredClone(j.v)
      const keys = pathKeys(args[1])
      const value =
        args[2] instanceof Json ? structuredClone(args[2].v) : args[2] instanceof Date ? args[2].toISOString() : args[2]
      let parent: unknown = doc
      for (const key of keys.slice(0, -1)) {
        // JSON_SET adds a member only where its parent exists; a missing parent leaves the document as it is
        if (!isObject(parent) || !isObject(parent[key])) return new Json(doc)
        parent = parent[key]
      }
      if (isObject(parent)) parent[keys[keys.length - 1]] = value
      return new Json(doc)
    }
    case "JSON_MERGE_PATCH": {
      const a = toJson(args[0])
      const b = toJson(args[1])
      if (a === null || b === null) return null
      return new Json(mergePatch(a.v, b.v))
    }
    default:
      throw new Error(`unsupported function: ${name}`)
  }
}
