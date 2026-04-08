import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider/next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { source } from '@/lib/source'
import 'fumadocs-ui/style.css'
import '@/styles/docs.css'

export default function Layout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return (
    <RootProvider>
      <DocsLayout
        tree={source.pageTree}
        nav={{ title: 'Billing Docs' }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  )
}
