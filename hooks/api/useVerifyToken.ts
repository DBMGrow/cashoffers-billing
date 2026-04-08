import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import type { User, ApiResponse } from "@/types/api"

export function useVerifyToken(token: string | null) {
  return useQuery({
    queryKey: ["verifyToken", token],
    queryFn: async () => {
      if (!token) return null
      const url = `/api/auth/jwt/verify/${encodeURIComponent(token)}`
      const { data } = await axios.get<ApiResponse<User>>(url)
      if (data.success !== "success") throw new Error("Invalid token")
      return data.data
    },
    enabled: !!token,
    retry: false,
  })
}
