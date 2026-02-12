import { useMutation } from "@tanstack/react-query"
import type { User, ApiResponse } from "@/types/api"

export function useLogin() {
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const json: ApiResponse<User> = await response.json()
      return json
    },
  })
}
