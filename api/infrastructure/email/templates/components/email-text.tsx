import { Text } from '@react-email/components'
import { colors, font } from './tokens'
import type { CSSProperties } from 'react'

type TextVariant = 'body' | 'muted' | 'small'

interface EmailTextProps {
  variant?: TextVariant
  children: React.ReactNode
  style?: CSSProperties
}

const variantStyles: Record<TextVariant, CSSProperties> = {
  body: {
    fontSize: font.size.base,
    color: colors.text.muted,
    lineHeight: font.lineHeight.relaxed,
  },
  muted: {
    fontSize: font.size.sm,
    color: colors.text.subtle,
    lineHeight: font.lineHeight.normal,
  },
  small: {
    fontSize: font.size.sm,
    color: colors.text.body,
    lineHeight: font.lineHeight.normal,
  },
}

/**
 * Body text component with semantic variants.
 *
 * - `body` — main paragraph text (15px, gray-500)
 * - `muted` — supporting/meta text (13px, gray-400)
 * - `small` — label-style text (13px, gray-700)
 */
export function EmailText({ variant = 'body', children, style }: EmailTextProps) {
  return (
    <Text
      style={{
        margin: '0 0 20px 0',
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </Text>
  )
}
