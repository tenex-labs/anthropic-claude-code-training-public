import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filtered", "all"] as const
type ExportScope = (typeof SCOPES)[number]

/**
 * Exports the payments table as CSV.
 *
 * Ops picks the columns and the scope (NWP-101). Both arrive from the
 * client, so both are checked against an allowlist before they reach the
 * query builder or the filename. Scope "filtered" honors the active
 * filters; "all" exports every payment.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const rawScope = params.get("scope") ?? "filtered"
  if (!SCOPES.includes(rawScope as ExportScope)) {
    return NextResponse.json(
      { message: "Unknown export scope. Use 'filtered' or 'all'." },
      { status: 400 },
    )
  }
  const scope = rawScope as ExportScope

  const columns = parseExportColumns(params.get("columns"))
  if (columns === null || columns.length === 0) {
    return NextResponse.json(
      { message: "Choose at least one valid export column." },
      { status: 400 },
    )
  }

  // "all" still goes through the one query builder — just with no filters.
  const filters = parseFilters(
    scope === "all" ? new URLSearchParams() : params,
  )
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  // Filename label from validated values only: the scope, or the
  // allowlisted status that parseFilters already checked.
  const scopeLabel =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), scopeLabel)}"`,
    },
  })
}
