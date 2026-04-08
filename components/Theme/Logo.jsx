"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

export default function Logo({ isLight }) {
  const router = useRouter()

  const logoProps = {
    className: `text-xl ${
      isLight ? "text-white bg-default-800" : "bg-default-200"
    } px-2 rounded`,
  }

  return (
    <Link className="flex" href="https://www.instantofferspro.com/agents">
      <h1 {...logoProps}>
        CashOffers<span className="text-secondary-color">.</span>PRO
      </h1>
    </Link>
  )
}
