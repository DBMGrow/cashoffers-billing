'use client'

import { useState, useEffect } from 'react'
import { DocsBody } from 'fumadocs-ui/page'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { Mermaid } from '@/components/mdx/mermaid'
import { source } from '@/lib/source'

/**
 * Renders MDX body client-side only. Large docs cause OOM during SSR
 * because the compiled MDX tree is too large for the RSC flight payload.
 */
export function DocsBodyClient({ slug }: { slug?: string[] }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const page = source.getPage(slug)

  if (!mounted || !page) {
    return (
      <DocsBody>
        <div className="animate-pulse space-y-4 py-8">
          <div className="h-4 w-3/4 rounded bg-fd-muted" />
          <div className="h-4 w-1/2 rounded bg-fd-muted" />
          <div className="h-4 w-2/3 rounded bg-fd-muted" />
        </div>
      </DocsBody>
    )
  }

  const MDX = page.data.body

  return (
    <DocsBody>
      <MDX components={{ ...defaultMdxComponents, Mermaid }} />
    </DocsBody>
  )
}
