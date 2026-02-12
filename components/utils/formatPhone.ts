export default function formatPhone(input: string): string {
  // remove all non-digit characters
  const phone = input.replace(/\D/g, "")
  const length = phone.length

  // format the phone number, even if partial
  if (length === 0) return ""
  if (length <= 3) return `(${phone}`
  if (length <= 6) return `(${phone.slice(0, 3)}) ${phone.slice(3)}`
  if (length <= 10) return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`
}
