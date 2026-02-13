interface RowProps {
  label: string
  value: string | number
  variant?: "primary"
}

export default function Row({ label, value, variant }: RowProps) {
  return (
    <div className="flex gap-2 justify-between items-center">
      <strong>{label}</strong>
      <div className={`${variant === "primary" ? "text-lg text-primary-color font-bold" : "text-muted text-sm"}`}>
        {value}
      </div>
    </div>
  )
}
