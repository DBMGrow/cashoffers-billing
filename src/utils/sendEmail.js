import sgMail from "@sendgrid/mail"
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export default function sendEmail(msg) {
  const { to, from = process.env.SYSTEM_EMAIL, subject, text, html } = msg
  msg = {
    to,
    from,
    subject,
    text,
  }

  try {
    if (process.env.SEND_EMAILS === "false") return console.log("Emails are disabled", to, from, subject, text, html)

    // convert text to html if html is not provided
    if (!html && text) msg.html = `<p>${text}</p>`

    sgMail
      .send(msg)
      .then((response) => {
        console.log("Email sent to " + to)
        // console.log(response[0].headers)
      })
      .catch((error) => {
        console.error("Error sending email to " + to + " with subject " + subject)
        console.error(error)
        console.log(error.response.body)
      })

    return true
  } catch (error) {
    console.log(msg, error)
    return false // error sending email
  }
}
