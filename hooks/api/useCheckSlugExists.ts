import { useQuery } from "@tanstack/react-query"
import axios from "axios"

export function useCheckSlugExists(slug: string | null) {
  return useQuery({
    queryKey: ["checkSlugExists", slug],
    queryFn: async () => {
      if (!slug) return null
      const { data } = await axios.get(`/api/checkslugexists/${encodeURIComponent(slug)}`)
      return data
    },
    enabled: !!slug && slug.length > 0,
  })
}
