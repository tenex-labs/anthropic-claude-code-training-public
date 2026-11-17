import { parseFilters, selectExportRows } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filter", "all"] as const

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Exports payments as CSV. Everything is decided here, on the server, from the
 * one query builder in src/data/queries.ts: the dialog only builds a URL, so
 * the file never depends on which page of the table is on screen.
 *
 *   columns  comma-separated, checked against EXPORT_COLUMNS (default: no last4)
 *   scope    "filter" (default) uses the table's filters; "all" ignores them
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") ?? "filter"
  if (!(SCOPES as readonly string[]).includes(scope)) {
    return badRequest("Unknown export scope.")
  }

  const parsed = parseExportColumns(params.get("columns"))
  if (!parsed.ok) return badRequest(parsed.error)

  const filters = parseFilters(
    scope === "all" ? new URLSearchParams() : params,
  )
  const rows = selectExportRows(filters)

  // Built only from allowlisted values, never from raw input.
  const narrowed = Boolean(
    filters.merchantId || filters.search || filters.from || filters.to,
  )
  const label =
    scope === "all" || (!narrowed && filters.status === "all")
      ? "all"
      : !narrowed
        ? String(filters.status)
        : "filtered"

  return new Response(toCsv(rows, parsed.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
