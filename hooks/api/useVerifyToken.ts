import { useQuery } from "@tanstack/react-query"
import type { User, ApiResponse } from "@/types/api"

export function useVerifyToken(token: string | null) {
  return useQuery({
    queryKey: ["verifyToken", token],
    queryFn: async () => {
      if (!token) return null
      const url = `${process.env.NEXT_PUBLIC_API_ROUTE_AUTH_V2}/auth/jwt/verify/${encodeURIComponent(token)}`
      const res = await fetch(url)
      const data: ApiResponse<User> = await res.json()
      if (data.success !== "success") throw new Error("Invalid token")
      return data.data
    },
    enabled: !!token,
    retry: false,
  })
}
