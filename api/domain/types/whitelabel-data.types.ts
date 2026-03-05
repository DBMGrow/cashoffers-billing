/**
 * Whitelabel Data Types
 *
 * These types define the structure of data stored in the JSON field
 * of the Whitelabels table.
 */

/**
 * Data stored in Whitelabels.data JSON field
 */
export interface WhitelabelData {
  /** Primary color for branding */
  primary_color?: string
  /** Secondary color for branding */
  secondary_color?: string
  /** Logo URL for the whitelabel */
  logo_url?: string
  /** Marketing website URL - where the logo should link to */
  marketing_website?: string
}
