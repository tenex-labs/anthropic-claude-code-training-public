import { merchantById } from "@/data/merchants"
import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseColumns, parseScope, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

function badRequest(message: string) {
  return NextResponse.json({ error: { message } }, { status: 400 })
}

/**
 * Exports the payments table as CSV (NWP-101).
 *
 * - `columns`: comma-separated, validated against the allowlist in csv.ts.
 *   Omitted → every column but card last four.
 * - `scope`: `filtered` (default) honors the active filters; `all` ignores them.
 *
 * Rows come from the one query builder, unpaginated, so the file holds every
 * matching payment rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseColumns(params.get("columns"))
  if (!columns.ok) return badRequest(columns.message)

  const scope = parseScope(params.get("scope"))
  if (!scope) return badRequest("Scope must be 'filtered' or 'all'.")

  const filters = parseFilters(scope === "all" ? new URLSearchParams() : params)
  // Sort order is presentation, not scope: keep what ops was looking at.
  const sorted = parseFilters(params)
  const rows = sortPayments(filterPayments(filters), sorted.sort, sorted.direction)

  // Only allowlisted values reach the filename: a known status, a known merchant.
  const label =
    scope === "all"
      ? ["all"]
      : [
          filters.status && filters.status !== "all" ? filters.status : null,
          filters.merchantId && merchantById(filters.merchantId)
            ? filters.merchantId
            : null,
          filters.search ? "search" : null,
        ].filter((part): part is string => part !== null)

  return new Response(toCsv(rows, columns.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label.length ? label : ["all"])}"`,
    },
  })
}
