import { Suspense } from "react"
import { Spinner } from "@/components/Theme/Spinner"
import FormsLayoutClient from "./FormsLayoutClient"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen w-screen bg-primary">
          <Spinner size="lg" color="secondary" />
        </div>
      }
    >
      <FormsLayoutClient>{children}</FormsLayoutClient>
    </Suspense>
  )
}
