import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import type { PurchaseFreeRequest, ApiResponse, User } from "@/types/api"

export function usePurchaseFree() {
  return useMutation({
    mutationFn: async (purchaseData: PurchaseFreeRequest) => {
      const { data } = await axios.post<ApiResponse<{ user: User }>>("/api/purchasefree", purchaseData)
      return data
    },
  })
}
