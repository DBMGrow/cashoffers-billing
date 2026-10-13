import { EmailLayout } from './email-layout'
import { EmailHeader } from './email-header'
import { EmailCard } from './email-card'
import { EmailFooter, type WhitelabelBrandingProps } from './email-footer'
import { SandboxBanner } from './sandbox-banner'

export type { WhitelabelBrandingProps }

interface StandardEmailProps {
  /** HTML <title> and email client tab name */
  title: string
  /** Short preview text shown in inbox before email is opened */
  preview: string
  /** Show sandbox warning banner */
  isSandbox?: boolean
  /** Whitelabel branding information */
  whitelabel?: WhitelabelBrandingProps
  /** Footer names REMrktCo as the merchant. Set only by templates that report a charge. */
  showChargeNotice?: boolean
  children: React.ReactNode
}

/**
 * Standard transactional email wrapper.
 * Composes Layout + Header + SandboxBanner + Card + Footer.
 * Used by most transactional templates — keeps them thin.
 */
export function StandardEmail({ title, preview, isSandbox, whitelabel, showChargeNotice, children }: StandardEmailProps) {
  return (
    <EmailLayout title={title} preview={preview}>
      <EmailHeader name={whitelabel?.name} />
      <SandboxBanner isSandbox={isSandbox} />
      <EmailCard>{children}</EmailCard>
      <EmailFooter whitelabel={whitelabel} showChargeNotice={showChargeNotice} />
    </EmailLayout>
  )
}
