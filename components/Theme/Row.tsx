interface RowProps {
  label: string
  value: string | number
  variant?: "primary"
}

export default function Row({ label, value, variant }: RowProps) {
  return (
    <div className="flex gap-2 justify-between items-center">
      <div className="text-default-700 font-bold">{label}</div>
      <div className={`${variant === "primary" ? "text-lg text-primary font-bold" : "text-default-600 text-sm"}`}>
        {value}
      </div>
    </div>
  )
}
