import Link from "next/link"
import Image from "next/image"

export default function YHSLogo({ isLight }) {
  const logoProps = {
    className: `font-bold text-xl ${
      isLight ? "text-white bg-default-800" : "text-default-700 bg-default-200"
    } px-2 py-2 rounded`,
    src: "/images/uco-logo2.png",
    width: 150,
    height: 50,
  }

  return (
    <Link className="flex" href="https://cashoffersite.com">
      <Image {...logoProps} alt="Ultimate Cash Offers" />
    </Link>
  )
}
