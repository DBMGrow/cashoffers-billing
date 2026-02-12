import Link from "next/link"
import Image from "next/image"

export default function ECOLogo({ isLight }) {
  const logoProps = {
    className: `font-bold text-xl ${
      isLight ? "text-white bg-default-800" : "text-default-700 bg-default-200"
    } px-2 py-2 pb-4 rounded`,
    src: "/images/eco.png",
    width: 200,
    height: 75,
  }

  return (
    <Link className="flex" href="https://estatecashoffers.com/">
      <Image {...logoProps} alt="ECO Logo" />
    </Link>
  )
}
