import { useQuery } from "@tanstack/react-query"

export function useCheckSlugExists(slug: string | null) {
  return useQuery({
    queryKey: ["checkSlugExists", slug],
    queryFn: async () => {
      if (!slug) return null
      const res = await fetch(`/api/checkslugexists/${encodeURIComponent(slug)}`)
      const data = await res.json()
      return data
    },
    enabled: !!slug && slug.length > 0,
  })
}
