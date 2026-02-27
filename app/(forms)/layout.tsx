import FormsLayout from "./FormsLayout"

export default function Layout({ children }: { children: React.ReactNode }) {
  return <FormsLayout whitelabel="default">{children}</FormsLayout>
}
