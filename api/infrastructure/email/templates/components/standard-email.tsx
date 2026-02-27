import { EmailLayout } from './email-layout'
import { EmailHeader } from './email-header'
import { EmailCard } from './email-card'
import { EmailFooter } from './email-footer'
import { SandboxBanner } from './sandbox-banner'

interface StandardEmailProps {
  /** HTML <title> and email client tab name */
  title: string
  /** Short preview text shown in inbox before email is opened */
  preview: string
  /** Show sandbox warning banner */
  isSandbox?: boolean
  children: React.ReactNode
}

/**
 * Standard transactional email wrapper.
 * Composes Layout + Header + SandboxBanner + Card + Footer.
 * Used by most transactional templates — keeps them thin.
 */
export function StandardEmail({ title, preview, isSandbox, children }: StandardEmailProps) {
  return (
    <EmailLayout title={title} preview={preview}>
      <EmailHeader />
      <SandboxBanner isSandbox={isSandbox} />
      <EmailCard>{children}</EmailCard>
      <EmailFooter />
    </EmailLayout>
  )
}
