"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useEffect, useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

type Counts =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; filter: number; all: number }

/** Row counts come from GET /api/payments, the same builder the export uses. */
async function fetchTotal(query: string, signal: AbortSignal): Promise<number> {
  const response = await fetch(`/api/payments${query ? `?${query}` : ""}`, {
    signal,
  })
  if (!response.ok) throw new Error(`Count failed: ${response.status}`)
  const body: { total: number } = await response.json()
  return body.total
}

/**
 * Export options (NWP-101). Collects choices and builds the download URL;
 * the file itself is produced on the server, so it is never limited to the
 * page of rows on screen.
 */
export function ExportDialog({ filterQuery }: { filterQuery: string }) {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<ExportScope>("filter")
  const [counts, setCounts] = useState<Counts>({ state: "loading" })

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setCounts({ state: "loading" })
    Promise.all([
      fetchTotal(filterQuery, controller.signal),
      fetchTotal("", controller.signal),
    ])
      .then(([filter, all]) => setCounts({ state: "ready", filter, all }))
      .catch(() => {
        if (!controller.signal.aborted) setCounts({ state: "error" })
      })
    return () => controller.abort()
  }, [open, filterQuery])

  const toggle = (column: ExportColumn) =>
    setColumns((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })

  // Canonical column order, whatever order the boxes were ticked in.
  const selected = EXPORT_COLUMNS.filter((column) => columns.has(column))

  const params = new URLSearchParams(scope === "filter" ? filterQuery : "")
  params.set("scope", scope)
  params.set("columns", selected.join(","))
  const href = `/api/payments/export?${params.toString()}`

  const countLabel = (value: number) =>
    `${value.toLocaleString()} ${value === 1 ? "payment" : "payments"}`
  const countFor = (which: ExportScope) =>
    counts.state === "ready" ? countLabel(counts[which]) : null

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes in the CSV before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {(
                [
                  ["filter", "Current filter"],
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
                  <span>{label}</span>
                  {countFor(value) && (
                    <span className="text-gray-500">· {countFor(value)}</span>
                  )}
                </label>
              ))}
            </div>
            <p
              className="mt-2 text-sm text-gray-500"
              role="status"
              aria-live="polite"
            >
              {counts.state === "loading" && "Counting payments…"}
              {counts.state === "error" &&
                "Could not count payments. The export still works."}
              {counts.state === "ready" &&
                `${countLabel(counts[scope])} will be exported.`}
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="export-columns"
                    value={column}
                    checked={columns.has(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {selected.length === 0 && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Choose at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="gap-2 sm:gap-0">
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {selected.length === 0 ? (
            <Button className="w-full sm:w-fit" disabled>
              Download CSV
            </Button>
          ) : (
            <Button className="w-full sm:w-fit" asChild>
              <a href={href} download onClick={() => setOpen(false)}>
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
