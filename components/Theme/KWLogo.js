import Link from "next/link"
import Image from "next/image"

export default function KWLogo({ isLight }) {
  const logoProps = {
    className: `font-bold text-xl ${isLight ? "text-white" : "text-default-700 "} px-2 py-2 rounded`,
    src: "/images/KO-Logo.png",
    width: 250,
    height: 50,
  }

  return (
    <Link className="flex" href="/platinum">
      <Image {...logoProps} alt="YHSGR Cash Offers" />
    </Link>
  )
}
