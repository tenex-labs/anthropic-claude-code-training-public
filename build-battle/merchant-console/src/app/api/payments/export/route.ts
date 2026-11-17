import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filter", "all"] as const
type Scope = (typeof SCOPES)[number]

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/** Built only from validated values, because it ends up in a header. */
function scopeLabel(scope: Scope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
}

/**
 * Exports payments as CSV.
 *
 * `columns` is a comma-separated subset of the export allowlist (default:
 * everything except the card last four). `scope` is `filter` (default, the
 * active filters) or `all`. Both are validated here; rows always come from
 * the shared query builder, unpaginated.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = (params.get("scope") ?? "filter") as Scope
  if (!SCOPES.includes(scope)) {
    return badRequest("Unknown export scope.")
  }

  const parsed = parseColumns(params.get("columns"))
  if (!parsed.ok) return badRequest(parsed.message)

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(new Date(), scopeLabel(scope, filters))
  return new Response(toCsv(rows, parsed.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
