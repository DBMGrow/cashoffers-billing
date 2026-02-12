export default function Table({ children, footer }) {
  return (
    <>
      <div className="flex flex-col gap-1 w-[400px] border-y-2 py-4 border-default-300">{children}</div>
      <div className="w-[400px] py-2">{footer}</div>
    </>
  )
}
