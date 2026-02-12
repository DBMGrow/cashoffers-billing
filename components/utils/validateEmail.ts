export default function validateEmail(input: string): boolean {
  if (typeof input !== "string") return false
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]{2,})+$/

  return regex.test(input)
}
