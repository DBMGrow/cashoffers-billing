import axios from "axios"

export default async function getUniqueSlug(name: string): Promise<string | null> {
  try {
    const { data } = await axios.get("/api/signup/getuniqueslug?name=" + encodeURIComponent(name))

    if (!data?.success) return null

    return data?.data?.slug
  } catch (error) {
    return null
  }
}
