import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  parseExportColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Honors the active filters and reuses the query builder, but the column set
 * and the scope are fixed. Giving ops control over both is NWP-101.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const scopeParam = params.get("scope")
  if (scopeParam !== null && scopeParam !== "current" && scopeParam !== "all") {
    return NextResponse.json({ message: "Invalid export scope" }, { status: 400 })
  }

  let columns
  try {
    columns = parseExportColumns(params.get("columns"))
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Invalid export columns" },
      { status: 400 },
    )
  }

  const scope = scopeParam ?? "current"
  const filters = parseFilters(params)
  const exportFilters =
    scope === "all"
      ? {
          ...filters,
          status: "all" as const,
          merchantId: undefined,
          search: undefined,
          from: undefined,
          to: undefined,
        }
      : filters
  const rows = sortPayments(
    filterPayments(exportFilters),
    exportFilters.sort,
    exportFilters.direction,
  )
  const label =
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
