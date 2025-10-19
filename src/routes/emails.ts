import { Router } from "express"
import parseEmailTemplate from "@/utils/parseEmailTemplate"

// await sendEmail({
//   to: email,
//   subject: "Subscription Created",
//   text: `You have been subscribed to ${memo}`,
//   template: "subscriptionCreated.html",
//   fields: {
//     amount: `$${(amount / 100).toFixed(2)}`,
//     date: new Date().toLocaleDateString(),
//     subscription: memo,
//     lineItems: `<ul>${lineItemsHtml}</ul>`,
//   },
// })

const emailsRouter = Router()

emailsRouter.post("/preview", async (req, res) => {
  const html = await parseEmailTemplate(req.body.templateName, req.body.variables)

  res.setHeader("Content-Type", "text/html")
  res.send(html)
})

export default emailsRouter
