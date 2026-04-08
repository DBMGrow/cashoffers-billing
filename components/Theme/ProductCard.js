import { Card, CardBody } from "@/components/Theme/Card"

export default function ProductCard({
  title,
  signup,
  description,
  price = 10,
  selected = false,
  onPress = () => null,
}) {
  const cardProps = {
    className: "grow w-full",
    isPressable: true,
    onPress,
  }
  const cardBodyProps = {
    className: `flex flex-col transition justify-between ${selected ? "bg-default-300" : ""}`,
  }

  return (
    <Card {...cardProps}>
      <CardBody {...cardBodyProps}>
        <div>
          <h3>{title}</h3>
          <div className="text-subtle text-sm">{description}</div>
        </div>
        <div className="mt-2">
          <div className="border-b-2 border-default-200 w-full h-px"></div>
          <div className="flex w-full gap-1 mt-2 items-end">
            <p className="font-bold text-xl text-secondary-color">${price / 100}</p>
            <p className="text-caption pb-[2px]">/mo</p>
          </div>
          {signup && <div className="text-caption">+$250 signup fee</div>}
        </div>
      </CardBody>
    </Card>
  )
}
