import { Row, Column, Text } from '@react-email/components'
import { colors, font, spacing } from './tokens'

interface MetricRowProps {
  label: string
  value: string
  /** Override the value text color for status indicators */
  valueColor?: string
}

/**
 * Two-column metric row for the daily health report.
 * Label on the left in muted gray, value on the right in dark with optional color.
 */
export function MetricRow({ label, value, valueColor = colors.text.heading }: MetricRowProps) {
  return (
    <Row style={{ marginBottom: spacing.sm }}>
      <Column style={{ width: '60%' }}>
        <Text
          style={{
            margin: '0',
            fontSize: font.size.sm,
            color: colors.text.muted,
          }}
        >
          {label}
        </Text>
      </Column>
      <Column style={{ width: '40%', textAlign: 'right' }}>
        <Text
          style={{
            margin: '0',
            fontSize: font.size.base,
            fontWeight: font.weight.semibold,
            color: valueColor,
          }}
        >
          {value}
        </Text>
      </Column>
    </Row>
  )
}

interface MetricCardProps {
  label: string
  value: string
  valueColor?: string
}

/**
 * Large centered metric card for summary stats at the top of the health report.
 */
export function MetricCard({ label, value, valueColor = colors.text.heading }: MetricCardProps) {
  return (
    <div style={{ textAlign: 'center', padding: `0 ${spacing.sm}` }}>
      <Text
        style={{
          margin: '0 0 4px 0',
          fontSize: font.size.xs,
          fontWeight: font.weight.semibold,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: colors.text.muted,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          margin: '0',
          fontSize: '28px',
          fontWeight: font.weight.bold,
          color: valueColor,
          lineHeight: font.lineHeight.tight,
        }}
      >
        {value}
      </Text>
    </div>
  )
}
