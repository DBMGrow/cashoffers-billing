class CodedError extends Error {
  constructor(message, code, data) {
    super(message) // Human-readable message
    this.name = this.constructor?.name || "Unnamed Error"
    this.code = code // Machine-readable details
    this.data = data
  }
}

export default CodedError
