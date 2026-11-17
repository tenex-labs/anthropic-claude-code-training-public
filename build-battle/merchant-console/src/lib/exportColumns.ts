/**
 * The columns the payments export can write.
 *
 * Kept in its own module, with no data imports, so the export panel in the
 * browser and the server share one definition without pulling merchant data
 * into the client bundle.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/**
 * What ships when the caller does not choose. The card last four is left out:
 * a file handed to a merchant should not carry it unless someone opts in.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")
