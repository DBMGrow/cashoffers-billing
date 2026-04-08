import { Hr } from '@react-email/components'
import { colors } from './tokens'

/**
 * Styled horizontal rule used to separate heading from body content.
 */
export function EmailDivider() {
  return (
    <Hr
      style={{
        borderColor: colors.border,
        borderTopWidth: '1px',
        margin: '0 0 20px 0',
      }}
    />
  )
}
