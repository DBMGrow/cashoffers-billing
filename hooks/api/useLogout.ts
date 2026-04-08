import { useMutation } from "@tanstack/react-query"
import axios from "axios"

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await axios.post("/api/auth/logout")
    },
  })
}
