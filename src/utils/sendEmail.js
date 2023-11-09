import sgMail from "@sendgrid/mail"
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export default function sendEmail(msg) {
  const { to, from = "david@dbmgrow.com", subject, text, html } = msg
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
        console.log(response[0].statusCode)
        // console.log(response[0].headers)
      })
      .catch((error) => {
        console.error(error)
        console.log(error.response.body)
      })
  } catch (error) {
    console.log(msg, error)
  }
}
