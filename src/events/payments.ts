import { listenToEvent } from "@/lib/eventBus"
import Payments from "@/lib/Payments"

listenToEvent("payments.card_charge_attempted", "Log Transaction", async (payload, req, res) => {
  const payments = new Payments(req, res)
  await payments.logTransaction(payload.payload)
})

listenToEvent("payments.card_charge_attempted", "Alert developer on Failure", async (payload, req, res) => {
  const payments = new Payments(req, res)
  await payments.alertDeveloperOnFailure(payload.payload)
})

listenToEvent("payments.card_charge_attempted", "Email user on failure", async (payload, req, res) => {
  const payments = new Payments(req, res)
  await payments.emailUserOnFailure(payload.payload)
})

listenToEvent("payments.card_charge_attempted", "Email user on success", async (payload, req, res) => {
  const payments = new Payments(req, res)
  await payments.emailUserOnSuccess(payload.payload)
})
