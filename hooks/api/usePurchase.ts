import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import type { PurchaseRequest, ApiResponse, User } from "@/types/api"

export function usePurchase() {
  return useMutation({
    mutationFn: async (purchaseData: PurchaseRequest) => {
      const { data } = await axios.post<ApiResponse<{ user: User; userProvisioned: boolean }>>("/api/purchase/new", purchaseData, {
        validateStatus: () => true,
      })
      return data
    },
  })
}
