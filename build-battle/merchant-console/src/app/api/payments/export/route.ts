import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client and are validated here before anything reaches the query builder,
 * the serializer, or the filename. The export is never paginated: "current
 * filter" means every matching row, not the page on screen.
 */

const SCOPES = ["filtered", "all"] as const
type Scope = (typeof SCOPES)[number]

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/** Built only from allowlisted values, so it is safe in a header. */
function filenameLabel(scope: Scope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") ?? "filtered"
  if (!SCOPES.includes(scope as Scope)) {
    return badRequest("Scope must be 'filtered' or 'all'.")
  }

  const columns = parseColumns(params.get("columns"))
  if (!columns) {
    return badRequest("Choose at least one valid column to export.")
  }

  const filters = parseFilters(
    scope === "all" ? new URLSearchParams() : params,
  )
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), filenameLabel(scope as Scope, filters))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
