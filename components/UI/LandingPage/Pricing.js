import { products } from "@/components/data/productsList"
import { productsInvestor } from "@/components/data/productsListInvestor"
import { Card, CardBody } from "@/components/Theme/Card"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import Link from "next/link"

export default function Pricing({ whitelabel, investor = false }) {
  // const hasSignupFee = whitelabel !== "platinum"
  const hasSignupFee = true

  function ProductCard({ product }) {
    if (product.hidden) return null
    return (
      <Card className="w-full">
        <CardBody className="flex flex-col gap-3 justify-between">
          <h3 className="text-center">{product.title}</h3>
          <div>
            <div className="flex justify-center text-price items-end">
              ${product.price / 100}
              <span className="text-caption pb-0.75">/mo</span>
            </div>
            {hasSignupFee && <div className="flex justify-center text-caption">+$250 signup fee</div>}
          </div>
          <div className="flex flex-col grow gap-2 text-sm">
            <div className="p-2 bg-gray-100 grow border border-gray-300 rounded">
              <p>{product.description}</p>
            </div>
          </div>
          <Link
            className="w-full flex flex-col"
            href={"/subscribe?product=" + product.productID + (whitelabel ? `&w=${whitelabel}` : "")}
          >
            <ThemeButton color="primary">Sign Up</ThemeButton>
          </Link>
        </CardBody>
      </Card>
    )
  }

  let prods = [...products]
  if (whitelabel === "platinum") {
    prods = [products[0]]

    return (
      <div className="grow flex justify-center gap-2 pb-[70px]">
        {prods.map((product) => (
          <ProductCard key={product.productID} product={product} />
        ))}
      </div>
    )
  }

  if (investor) {
    prods = productsInvestor

    return (
      <div className="grow flex justify-center gap-2 pb-[70px]">
        {prods.map((product) => (
          <ProductCard key={product.productID} product={product} />
        ))}
      </div>
    )
  }

  return (
    <div className="grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pb-[70px]">
      {prods.map((product) => (
        <ProductCard key={product.productID} product={product} />
      ))}
    </div>
  )
}
