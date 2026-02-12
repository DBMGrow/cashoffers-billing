export default async function getUniqueSlug(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      process.env.NEXT_PUBLIC_API_ROUTE_AUTH_V2 + "/signup/getuniqueslug?name=" + encodeURIComponent(name)
    )

    const data = await res.json()

    if (!data?.success) return null

    return data?.data?.slug
  } catch (error) {
    return null
  }
}
