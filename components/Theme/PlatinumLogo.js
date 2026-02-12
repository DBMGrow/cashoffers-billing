import Link from "next/link"
import Image from "next/image"

export default function PlatinumLogo({ isLight }) {
  const logoProps = {
    className: `font-bold text-xl ${isLight ? "text-white" : "text-default-700 "} px-2 py-2 rounded`,
    src: "/images/Proctor-Platinum-logo-oval.png",
    width: 150,
    height: 50,
  }

  return (
    <Link className="flex" href="/platinum">
      <Image {...logoProps} alt="YHSGR Cash Offers" />
    </Link>
  )
}
