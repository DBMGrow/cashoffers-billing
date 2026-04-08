import { db } from "@api/lib/database"

export const checkSlugExists = async (slug: string, depth = 0): Promise<string> => {
  let taken = await db
    .selectFrom("Websites_Dash")
    .where("Websites_Dash.slug", "=", slug)
    .select(["Websites_Dash.website_id"])
    .executeTakeFirst()

  if (taken) {
    const randomint = Math.floor(Math.random() * 100)

    return checkSlugExists(`${slug}${randomint}`, depth + 1)
  }

  if (depth > 10) {
    throw new Error("Could not find a unique slug")
  }

  return slug
}
