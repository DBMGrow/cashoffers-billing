import axios from "axios"

export default async function getUniqueSlug(name: string): Promise<string | null> {
  try {
    const { data } = await axios.get(
      process.env.NEXT_PUBLIC_API_ROUTE_AUTH_V2 + "/signup/getuniqueslug?name=" + encodeURIComponent(name)
    )

    if (!data?.success) return null

    return data?.data?.slug
  } catch (error) {
    return null
  }
}
