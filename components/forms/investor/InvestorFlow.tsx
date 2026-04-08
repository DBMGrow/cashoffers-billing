"use client"

import SubscribeFlow from "../subscribe/SubscribeFlow"
import { WhitelabelProvider } from "@/providers/WhitelabelProvider"

export default function InvestorFlow() {
  return (
    <WhitelabelProvider initialWhitelabel="default">
      <SubscribeFlow initialProduct={11} whitelabel="default" />
    </WhitelabelProvider>
  )
}
