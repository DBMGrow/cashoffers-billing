import { useMutation } from "@tanstack/react-query"
import type { PurchaseRequest, ApiResponse, User } from "@/types/api"

export function usePurchase() {
  return useMutation({
    mutationFn: async (data: PurchaseRequest) => {
      const response = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json: ApiResponse<{ user: User }> = await response.json()
      return json
    },
  })
}
