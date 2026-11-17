import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  type ExportScope,
  exportFilename,
  exportLabel,
  parseColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES: readonly ExportScope[] = ["filter", "all"]

function isScope(value: string): value is ExportScope {
  return (SCOPES as readonly string[]).includes(value)
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Exports the payments table as CSV.
 *
 * Query parameters, all optional:
 * - `columns`: comma-separated column names, in the order they should appear.
 *   Defaults to every column except the card last four.
 * - `scope`: `filter` (default) honors the active filters; `all` ignores them.
 *
 * Both are validated here against allowlists. The rows always come from the
 * shared query builder, never from the page the caller happened to be on, so
 * the file is never limited to one page of the table.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const selection = parseColumns(params.get("columns"))
  if (!selection.ok) return badRequest(selection.error)

  const scope = params.get("scope") ?? "filter"
  if (!isScope(scope)) return badRequest("Scope must be filter or all.")

  const filters = parseFilters(
    scope === "all" ? new URLSearchParams() : params,
  )
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, selection.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), exportLabel(scope, filters))}"`,
    },
  })
}
