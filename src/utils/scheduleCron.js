import cron from "node-cron"
import fetch from "node-fetch"
import sendEmail from "./sendEmail"

export default function scheduleCron(time, route) {
  if (process.env.CRON_ACTIVE === "false") return false

  //this is just to test the cron job
  sendEmail({
    to: "david@dbmgrow.com",
    subject: "Cron Job Started",
    text: `Cron job started for ${route} `,
  })

  cron.schedule(time, async () => {
    try {
      await fetch(process.env.BASE_URL + route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: process.env.CRON_SECRET }),
      }).then((res) => res.json())
    } catch (error) {
      console.log("Error running cron:", error)
    }
  })
}
