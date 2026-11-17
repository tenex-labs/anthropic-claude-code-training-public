import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filter", "all"] as const
type Scope = (typeof SCOPES)[number]

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}

/**
 * Exports payments as CSV.
 *
 * `scope=filter` (default) honors the active filters; `scope=all` ignores
 * them. `columns` is a comma-separated subset of the export allowlist; when
 * absent, the default set (no card last four) is used. Both are validated
 * here, and rows always come from the shared query builder.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") ?? "filter"
  if (!SCOPES.includes(scope as Scope)) {
    return badRequest("Unknown export scope.")
  }

  const columns = parseExportColumns(params.get("columns"))
  if (columns === null) {
    return badRequest("Unknown export column.")
  }
  if (columns.length === 0) {
    return badRequest("Choose at least one column to export.")
  }

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  // The filename label is built only from allowlisted values, never raw input.
  let label = "all"
  if (scope === "filter") {
    if (filters.status && filters.status !== "all") {
      label = filters.status
    } else if (
      filters.merchantId ||
      filters.search ||
      filters.from ||
      filters.to
    ) {
      label = "filtered"
    }
  }

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
