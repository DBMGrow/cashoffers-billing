import { useMutation } from "@tanstack/react-query"
import type { PurchaseFreeRequest, ApiResponse, User } from "@/types/api"

export function usePurchaseFree() {
  return useMutation({
    mutationFn: async (data: PurchaseFreeRequest) => {
      const response = await fetch("/api/purchasefree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json: ApiResponse<{ user: User }> = await response.json()
      return json
    },
  })
}
