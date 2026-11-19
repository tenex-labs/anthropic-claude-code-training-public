import {
  parseFilters,
  queryPayments,
  validateFilterParams,
} from "@/data/queries"
import { NextRequest, NextResponse } from "next/server"

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const invalid = validateFilterParams(params)
  if (invalid) return NextResponse.json({ message: invalid }, { status: 400 })

  return NextResponse.json(queryPayments(parseFilters(params)))
}
