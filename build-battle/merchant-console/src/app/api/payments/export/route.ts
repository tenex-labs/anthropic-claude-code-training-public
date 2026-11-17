import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filtered", "all"] as const
type Scope = (typeof SCOPES)[number]

/** Error body is `{ error }`, a message safe to show a user. */
function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Exports the payments table as CSV (NWP-101).
 *
 * - `columns`: comma-separated, validated against EXPORT_COLUMNS. Absent means
 *   the defaults, which leave out card last four.
 * - `scope`: `filtered` (default) honors the active filters; `all` clears them.
 *
 * Rows always come from the one query builder, unpaginated, so the file holds
 * every matching payment rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const rawScope = params.get("scope") ?? "filtered"
  if (!SCOPES.includes(rawScope as Scope)) {
    return badRequest("Unknown export scope. Allowed: filtered, all.")
  }
  const scope = rawScope as Scope

  const parsed = parseExportColumns(params.get("columns"))
  if (parsed.error !== undefined) return badRequest(parsed.error)

  const filters = parseFilters(params)
  const matching = filterPayments(scope === "all" ? {} : filters)
  const rows = sortPayments(matching, filters.sort, filters.direction)

  // Filename label comes only from allowlisted values, never search text.
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
