import axios from "axios"

const sendChatMessage = async (message: string): Promise<void> => {
  await axios.post(process.env.CHAT_WEBHOOK_URL, {
    text: message,
  })
}

export default sendChatMessage
