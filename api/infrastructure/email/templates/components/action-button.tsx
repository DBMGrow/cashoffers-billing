import { Button, Section } from '@react-email/components'
import { font, radius } from './tokens'

type ButtonVariant = 'danger' | 'warning' | 'primary'

interface ActionButtonProps {
  href: string
  children: React.ReactNode
  variant?: ButtonVariant
}

const variantColors: Record<ButtonVariant, { bg: string; hover?: string }> = {
  danger: { bg: '#dc2626' },
  warning: { bg: '#d97706' },
  primary: { bg: '#1e40af' },
}

/**
 * Full-width CTA button for transactional emails.
 *
 * - `danger` (red) — update billing, failed payment recovery
 * - `warning` (amber) — contact support, paused/suspended
 * - `primary` (blue) — general call-to-action
 */
export function ActionButton({ href, children, variant = 'primary' }: ActionButtonProps) {
  const { bg } = variantColors[variant]

  return (
    <Section style={{ textAlign: 'center', marginTop: '24px' }}>
      <Button
        href={href}
        style={{
          backgroundColor: bg,
          color: '#ffffff',
          fontSize: font.size.base,
          fontWeight: font.weight.semibold,
          borderRadius: radius.md,
          padding: '13px 28px',
          textDecoration: 'none',
          display: 'inline-block',
          lineHeight: '1',
        }}
      >
        {children}
      </Button>
    </Section>
  )
}
