class CodedError extends Error {
  code: number
  data: any

  constructor(message: string, code: number, data?: any) {
    super(message) // Human-readable message
    this.name = this.constructor?.name || "Unnamed Error"
    this.code = code // Machine-readable details
    this.data = data
  }
}

export default CodedError
