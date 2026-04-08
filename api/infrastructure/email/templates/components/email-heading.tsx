import { Text } from '@react-email/components'
import { colors, font } from './tokens'

interface EmailHeadingProps {
  children: React.ReactNode
}

/**
 * Primary heading for the email card content area.
 */
export function EmailHeading({ children }: EmailHeadingProps) {
  return (
    <Text
      style={{
        margin: '0 0 20px 0',
        fontSize: font.size.xl,
        fontWeight: font.weight.bold,
        color: colors.text.heading,
        lineHeight: font.lineHeight.tight,
      }}
    >
      {children}
    </Text>
  )
}
