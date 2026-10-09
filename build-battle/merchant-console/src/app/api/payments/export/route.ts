import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  EXPORT_SCOPES,
  ExportScope,
  exportFilename,
  parseExportColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` and `scope` come from the client and are checked against
 * allowlists before anything else runs. Rows come from the same query
 * builder as GET /api/payments, unpaginated, so the file is every matching
 * payment rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") ?? "filter"
  if (!(EXPORT_SCOPES as readonly string[]).includes(scope)) {
    return NextResponse.json(
      { error: "Export scope must be the current filter or all payments." },
      { status: 400 },
    )
  }

  const parsed = parseExportColumns(params.get("columns"))
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  // "All payments" still goes through the builder, just with no filters.
  const filterParams = new URLSearchParams()
  for (const key of ["sort", "direction"]) {
    const value = params.get(key)
    if (value) filterParams.set(key, value)
  }
  const filters = parseFilters(scope === "all" ? filterParams : params)

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, parsed.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        new Date(),
        filenameLabel(scope as ExportScope, filters.status),
      )}"`,
    },
  })
}

/** Only allowlisted values reach the filename. */
function filenameLabel(scope: ExportScope, status: string | undefined) {
  if (scope === "all") return "all"
  return status && status !== "all" ? status : "filtered"
}
