export default function formatDate(input: string | Date | undefined): string {
  if (!input) return "N/A"

  try {
    const date = new Date(input)
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
    return date.toLocaleDateString("en-US", options)
  } catch (error) {
    console.error(error)
    return String(input)
  }
}
