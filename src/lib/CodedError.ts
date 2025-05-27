class CodedError extends Error {
  code: number
  data: any
  name: string

  constructor(message: string, code: number, data: any = null) {
    super(message)
    this.name = this.constructor?.name || "Unnamed Error"
    this.code = code ?? 500
    this.data = data ?? null
  }
}

export default CodedError
