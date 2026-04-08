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
      const { data } = await axios.get<CheckUserResponse>(`/api/signup/checkuserexists/${encodeURIComponent(email)}`)

      return data
    },
  })
}
