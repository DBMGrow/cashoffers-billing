import { colors, radius, spacing } from './tokens'

interface SummaryTableProps {
  children: React.ReactNode
}

/**
 * Container for receipt-style detail tables used in payment and subscription emails.
 * Wrap SummaryRow and LineItemsTable children inside this.
 *
 * Example:
 * ```tsx
 * <SummaryTable>
 *   <SummaryRow isHeader label="Order Summary" value="" />
 *   <LineItemsTable items={lineItems} />
 *   <SummaryRow isTotal label="Total" value="$99.00" />
 *   <SummaryRow label="Transaction Date" value="January 31, 2024" bordered={false} />
 * </SummaryTable>
 * ```
 */
export function SummaryTable({ children }: SummaryTableProps) {
  return (
    <table
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{
        borderCollapse: 'collapse',
        backgroundColor: colors.bg.subtle,
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        marginTop: spacing.lg,
        marginBottom: '0',
        overflow: 'hidden',
      }}
    >
      <tbody>{children}</tbody>
    </table>
  )
}
