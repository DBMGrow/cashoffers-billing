import Link from "next/link"
import { useRouter } from "next/router"

export default function InvestorLogo({ isLight }) {
  const logoProps = {
    className: `font-bold text-xl ${
      isLight ? "text-white bg-default-800" : "text-default-700 bg-default-200"
    } px-2 rounded`,
  }

  return (
    <Link className="flex" href="https://www.instantofferspro.com/investors">
      <h1 {...logoProps}>
        CashOffers<span className="text-secondary ">.</span>PRO
      </h1>
    </Link>
  )
}
