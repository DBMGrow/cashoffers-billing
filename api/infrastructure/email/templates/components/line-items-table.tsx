import { colors, font } from './tokens'

export interface LineItem {
  description: string
  amount: number // in cents
}

interface LineItemsTableProps {
  items: LineItem[]
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Renders financial line items as styled table rows inside a SummaryTable.
 * Replaces the old formatLineItemsHtml() helper that built HTML strings.
 *
 * Usage: place between a SummaryRow isHeader and SummaryRow isTotal.
 */
export function LineItemsTable({ items }: LineItemsTableProps) {
  return (
    <>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const borderColor = isLast ? colors.border : colors.borderSubtle

        return (
          <tr key={index}>
            <td
              style={{
                color: colors.text.body,
                fontSize: font.size.sm,
                padding: '0 0 0 16px',
              }}
            >
              <div
                style={{
                  padding: '10px 0',
                  borderBottom: `1px solid ${borderColor}`,
                }}
              >
                {item.description}
              </div>
            </td>
            <td
              style={{
                textAlign: 'right',
                fontSize: font.size.sm,
                color: colors.text.body,
                padding: '0 16px 0 0',
              }}
            >
              <div
                style={{
                  padding: '10px 0',
                  borderBottom: `1px solid ${borderColor}`,
                }}
              >
                {formatCurrency(item.amount)}
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}
