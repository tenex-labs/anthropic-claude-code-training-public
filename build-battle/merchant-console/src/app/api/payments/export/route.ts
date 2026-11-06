import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filtered", "all"] as const
type ExportScope = (typeof SCOPES)[number]

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Exports the payments table as CSV (NWP-101).
 *
 * Query params, all validated here against allowlists:
 * - `scope`: `filtered` (default) uses the request's filters, `all` ignores them
 * - `columns`: comma-separated export columns; absent means the defaults,
 *   which leave out the card last four
 * - the usual payment filters, parsed by the shared query builder
 *
 * Every row matching the scope is exported, not just the visible page.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scopeParam = params.get("scope") ?? "filtered"
  if (!SCOPES.includes(scopeParam as ExportScope)) {
    return badRequest('Export scope must be "filtered" or "all".')
  }
  const scope = scopeParam as ExportScope

  const parsed = parseExportColumns(params.get("columns"))
  if (!parsed.ok) return badRequest(parsed.message)

  const filters = parseFilters(
    scope === "all" ? new URLSearchParams() : params,
  )
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const label =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, parsed.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
