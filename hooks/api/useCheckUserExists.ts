import { useQuery } from "@tanstack/react-query"
import type { ApiResponse } from "@/types/api"

interface CheckUserResponse {
  userExists: boolean
  hasCard?: boolean
  canSetUpCard?: boolean
  plan?: number
  offerDowngrade?: boolean
}

export function useCheckUserExists(email: string | null) {
  return useQuery({
    queryKey: ["checkUserExists", email],
    queryFn: async () => {
      if (!email) return null
      const res = await fetch(`/api/checkuserexists/${encodeURIComponent(email)}`)
      const data: ApiResponse<CheckUserResponse> = await res.json()
      if (data.success !== "success") throw new Error("Failed to check user")
      return data.data
    },
    enabled: !!email,
  })
}
