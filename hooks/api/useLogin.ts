import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import type { User, ApiResponse } from "@/types/api"

export function useLogin() {
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data } = await axios.post<ApiResponse<User>>("/api/login", { email, password })
      return data
    },
  })
}
