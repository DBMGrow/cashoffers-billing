import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import type { User, ApiResponse } from "@/types/api"

export function useSession() {
  return useQuery<User | null>({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await axios.get<ApiResponse<User>>("/api/auth/check")
      if (data.success !== "success" || !data.data) return null
      return data.data
    },
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
