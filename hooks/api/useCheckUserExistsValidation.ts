import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import type { ApiResponse } from "@/types/api"

interface CheckUserResponse {
  userExists: boolean
  hasCard?: boolean
  canSetUpCard?: boolean
  plan?: number
  offerDowngrade?: boolean
}

export function useCheckUserExistsValidation() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await axios.get<ApiResponse<CheckUserResponse>>(
        `/api/signup/checkuserexists/${encodeURIComponent(email)}`
      )
      if (data.success !== "success") {
        throw new Error("Failed to check user")
      }
      return data.data
    },
  })
}
