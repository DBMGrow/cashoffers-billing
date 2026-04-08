import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { User } from "@/types/api"

const USER_QUERY_KEY = ["user"] as const

export function useUser() {
  const queryClient = useQueryClient()

  const { data: user = null } = useQuery<User | null>({
    queryKey: USER_QUERY_KEY,
    queryFn: () => null,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const setUser = (userData: User | null) => {
    queryClient.setQueryData(USER_QUERY_KEY, userData)
  }

  return { user, setUser }
}
