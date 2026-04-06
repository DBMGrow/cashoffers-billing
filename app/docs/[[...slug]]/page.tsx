import { source } from '@/lib/source'
import { DocsPage } from 'fumadocs-ui/page'
import { notFound } from 'next/navigation'
import { DocsBodyClient } from './docs-body-client'

interface Props {
  params: Promise<{ slug?: string[] }>
}

export default async function Page({ params }: Props) {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  return (
    <DocsPage toc={page.data.toc}>
      <DocsBodyClient slug={slug} />
    </DocsPage>
  )
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
  }
}
