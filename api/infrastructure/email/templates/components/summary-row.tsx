import { colors, font } from './tokens'

interface SummaryRowProps {
  label: string
  value: string
  /** Renders the value larger and bold — for totals */
  isTotal?: boolean
  /** Renders as a section sub-header row (uppercase label, no value) */
  isHeader?: boolean
  /** Whether to show bottom border (default true) */
  bordered?: boolean
}

/**
 * A single row inside a SummaryTable.
 *
 * Use `isHeader` for the "Order Summary" section header.
 * Use `isTotal` for the "Total" row with the large amount.
 * Rows are bordered by default to visually separate each entry.
 */
export function SummaryRow({
  label,
  value,
  isTotal = false,
  isHeader = false,
  bordered = true,
}: SummaryRowProps) {
  const borderStyle = bordered ? `1px solid ${colors.border}` : 'none'
  const paddingY = isHeader ? '12px' : isTotal ? '14px' : '13px'

  if (isHeader) {
    return (
      <tr>
        <td
          colSpan={2}
          style={{
            padding: `0 16px`,
            borderBottom: borderStyle,
          }}
        >
          <div
            style={{
              padding: `${paddingY} 0`,
              fontSize: font.size.xs,
              fontWeight: font.weight.semibold,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: colors.text.subtle,
            }}
          >
            {label}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td
        style={{
          padding: '0 0 0 16px',
          color: isTotal ? colors.text.heading : colors.text.subtle,
          fontSize: font.size.sm,
          fontWeight: isTotal ? font.weight.semibold : font.weight.normal,
        }}
      >
        <div
          style={{
            padding: `${paddingY} 0`,
            borderBottom: borderStyle,
          }}
        >
          {label}
        </div>
      </td>
      <td
        style={{
          textAlign: 'right',
          padding: '0 16px 0 0',
        }}
      >
        <div
          style={{
            padding: `${paddingY} 0`,
            borderBottom: borderStyle,
            fontSize: isTotal ? '18px' : font.size.sm,
            fontWeight: isTotal ? font.weight.bold : font.weight.normal,
            color: isTotal ? colors.text.heading : colors.text.body,
            letterSpacing: isTotal ? '-0.3px' : 'normal',
          }}
        >
          {value}
        </div>
      </td>
    </tr>
  )
}
