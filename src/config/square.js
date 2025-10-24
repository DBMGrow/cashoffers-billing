import { Client, Environment, ApiError } from "square"

const square = new Client({
  environment: process.env.SQUARE_ENVIRONMENT === "sandbox" ? Environment.Sandbox : Environment.Production,
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
})

export default square
