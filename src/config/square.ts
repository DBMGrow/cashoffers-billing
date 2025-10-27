import { SquareClient, SquareEnvironment, SquareError } from "square"

const square = new SquareClient({
  environment: process.env.SQUARE_ENVIRONMENT === "sandbox" ? SquareEnvironment.Sandbox : SquareEnvironment.Production,
  token: process.env.SQUARE_ACCESS_TOKEN,
})

export default square
