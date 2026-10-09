"use client"

import { Button } from "@/components/Button"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
import * as DialogPrimitives from "@radix-ui/react-dialog"
import { Download } from "lucide-react"
import { useEffect, useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

type Scope = "filtered" | "all"

/**
 * Export options for the payments table (NWP-101). Ops picks columns and
 * scope; the server re-validates both. The row count comes from
 * GET /api/payments — the same query builder the table uses — so the number
 * shown is the number the file will contain.
 */
export function ExportDialog({ query }: { query: string }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("filtered")
  const [selected, setSelected] = useState<ReadonlySet<ExportColumn>>(
    new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [counts, setCounts] = useState<{
    filtered: number | null
    all: number | null
  }>({ filtered: null, all: null })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const count = async (params: string): Promise<number | null> => {
      try {
        const res = await fetch(`/api/payments${params ? `?${params}` : ""}`)
        if (!res.ok) return null
        const body = (await res.json()) as { total: number }
        return body.total
      } catch {
        return null
      }
    }
    Promise.all([count(query), count("")]).then(([filtered, all]) => {
      if (!cancelled) setCounts({ filtered, all })
    })
    return () => {
      cancelled = true
    }
  }, [open, query])

  const toggle = (column: ExportColumn) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  // Preserve the canonical column order regardless of click order.
  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const rowCount = counts[scope]

  const downloadHref = () => {
    const params = new URLSearchParams(query)
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
  }

  return (
    <DialogPrimitives.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitives.Trigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogPrimitives.Trigger>
      <DialogPrimitives.Portal>
        <DialogPrimitives.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-dialogOverlayShow" />
        <DialogPrimitives.Content
          className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-900 dark:bg-[#090E1A]"
          aria-describedby="export-dialog-description"
        >
          <DialogPrimitives.Title className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Export payments
          </DialogPrimitives.Title>
          <DialogPrimitives.Description
            id="export-dialog-description"
            className="mt-1 text-sm text-gray-500"
          >
            Choose the columns and the scope. Card last four is off by
            default.
          </DialogPrimitives.Description>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {(
                [
                  ["filtered", "Current filter"],
                  ["all", "All payments"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 accent-blue-600"
                  />
                  {label}
                  <span className="text-gray-500">
                    {counts[value] !== null
                      ? `· ${counts[value]!.toLocaleString()} rows`
                      : "· counting…"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                    className="size-4 accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 flex items-center justify-end gap-2">
            <DialogPrimitives.Close asChild>
              <Button variant="secondary" className="py-1.5">
                Cancel
              </Button>
            </DialogPrimitives.Close>
            <Button
              className="gap-2 py-1.5"
              disabled={columns.length === 0}
              asChild={columns.length > 0}
            >
              {columns.length > 0 ? (
                <a href={downloadHref()} onClick={() => setOpen(false)}>
                  <Download className="-ml-0.5 size-4" aria-hidden="true" />
                  Download
                  {rowCount !== null ? ` ${rowCount.toLocaleString()} rows` : ""}
                </a>
              ) : (
                <span>Download</span>
              )}
            </Button>
          </div>
        </DialogPrimitives.Content>
      </DialogPrimitives.Portal>
    </DialogPrimitives.Root>
  )
}
