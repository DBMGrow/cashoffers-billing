import mjml2html from "mjml"
import { promises as fs } from "fs"
import path from "path"
import { IMjmlCompiler, MjmlCompilationResult } from "./mjml-compiler.interface"
import { ILogger } from "@api/infrastructure/logging/logger.interface"

const LAYOUT_CONTENT_PLACEHOLDER = "{{{CONTENT}}}"
const DEFAULT_LAYOUT_FILENAME = "_layout.mjml"

/**
 * MJML Compiler Implementation
 *
 * Compiles MJML templates to responsive HTML emails
 * with variable substitution support.
 *
 * Templates that begin with <mjml> are compiled as standalone documents.
 * All other templates are treated as content fragments and automatically
 * wrapped in _layout.mjml (from the same directory). Pass layoutPath to
 * override which layout is used.
 */
export class MjmlCompiler implements IMjmlCompiler {
  constructor(private readonly logger: ILogger) {}

  async compile(mjml: string, variables?: Record<string, string>): Promise<string> {
    try {
      // Replace variables in MJML
      let processedMjml = mjml
      if (variables) {
        processedMjml = this.replaceVariables(mjml, variables)
      }

      // Compile MJML to HTML
      const result = mjml2html(processedMjml, {
        validationLevel: "soft", // Don't fail on warnings
        minify: false, // Keep readable for debugging
      })

      if (result.errors.length > 0) {
        this.logger.warn("MJML compilation warnings", {
          errors: result.errors,
        })
      }

      return result.html
    } catch (error) {
      this.logger.error("MJML compilation failed", { error })
      throw new Error(`Failed to compile MJML: ${error}`)
    }
  }

  async compileFile(
    templatePath: string,
    variables?: Record<string, string>,
    layoutPath?: string
  ): Promise<string> {
    try {
      const mjml = await fs.readFile(templatePath, "utf-8")
      const trimmed = mjml.trimStart()

      // Full MJML document — compile as-is (layout opt-out)
      if (trimmed.startsWith("<mjml>")) {
        return this.compile(mjml, variables)
      }

      // Content fragment — wrap in default layout
      const effectiveLayoutPath =
        layoutPath ?? path.join(path.dirname(templatePath), DEFAULT_LAYOUT_FILENAME)

      const layoutMjml = await fs.readFile(effectiveLayoutPath, "utf-8")

      // Inject fragment into layout before variable substitution
      const combined = layoutMjml.replace(LAYOUT_CONTENT_PLACEHOLDER, trimmed)

      const enrichedVariables: Record<string, string> = {
        currentYear: String(new Date().getFullYear()),
        emailTitle: "CashOffers",
        emailPreview: "",
        ...variables,
      }

      return this.compile(combined, enrichedVariables)
    } catch (error) {
      this.logger.error("Failed to read MJML file", {
        templatePath,
        error,
      })
      throw new Error(`Failed to read MJML file: ${templatePath}`)
    }
  }

  /**
   * Replace {{variable}} placeholders with actual values
   */
  private replaceVariables(mjml: string, variables: Record<string, string>): string {
    let result = mjml

    for (const [key, value] of Object.entries(variables)) {
      // Replace {{key}} with value
      const placeholder = `{{${key}}}`
      result = result.split(placeholder).join(value)
    }

    return result
  }
}

/**
 * Create an MJML compiler instance
 */
export const createMjmlCompiler = (logger: ILogger): IMjmlCompiler => {
  return new MjmlCompiler(logger)
}
