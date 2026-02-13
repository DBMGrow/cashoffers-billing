import { useMutation } from "@tanstack/react-query"
import axios from "axios"

interface CheckSlugResponse {
  success: string
  userExists: boolean
}

export function useCheckSlugExistsValidation() {
  return useMutation({
    mutationFn: async (slug: string) => {
      const { data } = await axios.get<CheckSlugResponse>(
        `/api/checkslugexists/${encodeURIComponent(slug)}`
      )
      if (data.success !== "success") {
        throw new Error("Failed to check slug")
      }
      return data
    },
  })
}
