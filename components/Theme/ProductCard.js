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
        <div className="">
          <h3 className={`font-medium`}>{title}</h3>
          <div className="text-default-500 text-sm">{description}</div>
        </div>
        <div className="mt-2">
          <div className="border-b-2 border-default-200 w-full h-px"></div>
          <div className="flex w-full gap-1 mt-2 items-end">
            <p className="font-bold text-xl text-secondary">${price / 100}</p>
            <p className="text-sm text-default-700 font-medium pb-[2px]">/mo</p>
          </div>
          {signup && <div className="text-xs">+$250 signup fee</div>}
        </div>
      </CardBody>
    </Card>
  )
}
