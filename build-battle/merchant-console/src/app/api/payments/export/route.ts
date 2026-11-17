import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  ExportLabel,
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` and `scope` come from the export dialog and are checked against
 * allowlists before anything is read. Rows go through the same query builder
 * as `GET /api/payments`, without pagination, so the file holds every
 * matching row rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (!columns) {
    return NextResponse.json(
      { error: "Choose at least one valid column to export." },
      { status: 400 },
    )
  }

  const scope = parseExportScope(params.get("scope"))
  if (!scope) {
    return NextResponse.json(
      { error: "Scope must be the current filter or all payments." },
      { status: 400 },
    )
  }

  const filters: PaymentFilters = scope === "all" ? {} : parseFilters(params)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  // Only validated values reach the filename, because it goes into a header.
  const label: ExportLabel =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
