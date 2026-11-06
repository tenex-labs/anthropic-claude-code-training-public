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
import type { ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at (UTC)",
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
 * Export options for the payments table (NWP-101).
 *
 * This only builds the request. The route handler re-validates every column
 * and the scope, and does the filtering through the shared query builder, so
 * the export covers every matching row rather than the page on screen.
 */
export function ExportDialog({
  columns,
  defaultColumns,
  query,
  filteredCount,
  totalCount,
}: {
  columns: readonly ExportColumn[]
  defaultColumns: readonly ExportColumn[]
  /** The table's current filters as a query string, without `page`. */
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ExportColumn[]>([...defaultColumns])
  const [scope, setScope] = useState<Scope>("filtered")

  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected((current) =>
      checked
        ? columns.filter((c) => c === column || current.includes(c))
        : current.filter((c) => c !== column),
    )

  const rowCount = scope === "all" ? totalCount : filteredCount
  const canDownload = selected.length > 0

  const href = (() => {
    const params = new URLSearchParams(scope === "all" ? "" : query)
    params.set("scope", scope)
    params.set("columns", selected.join(","))
    return `/api/payments/export?${params.toString()}`
  })()

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setSelected([...defaultColumns])
          setScope("filtered")
        }
      }}
    >
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
          <DrawerDescription className="text-sm">
            Choose what goes into the CSV file.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              <ScopeOption
                value="filtered"
                checked={scope === "filtered"}
                onSelect={setScope}
                label="Current filter"
                count={filteredCount}
              />
              <ScopeOption
                value="all"
                checked={scope === "all"}
                onSelect={setScope}
                label="All payments"
                count={totalCount}
              />
            </div>
          </fieldset>

          <fieldset>
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
                Columns
              </legend>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  className="text-blue-600 hover:underline dark:text-blue-500"
                  onClick={() => setSelected([...defaultColumns])}
                >
                  Defaults
                </button>
                <button
                  type="button"
                  className="text-blue-600 hover:underline dark:text-blue-500"
                  onClick={() => setSelected([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={column}
                    checked={selected.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className="size-4 rounded border-gray-300 accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {selected.includes("last4") && (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
                Card last four is included. Remove it before sending this file to a
                merchant.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2">
          <p className="mr-auto text-sm text-gray-500" aria-live="polite">
            {canDownload
              ? `${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"} · ${selected.length} ${selected.length === 1 ? "column" : "columns"}`
              : "Choose at least one column to download."}
          </p>
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {canDownload ? (
            <Button className="w-full gap-2 sm:w-fit" asChild>
              <a href={href} download onClick={() => setOpen(false)}>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download CSV
              </a>
            </Button>
          ) : (
            <Button className="w-full gap-2 sm:w-fit" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download CSV
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function ScopeOption({
  value,
  checked,
  onSelect,
  label,
  count,
}: {
  value: Scope
  checked: boolean
  onSelect: (scope: Scope) => void
  label: string
  count: number
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        type="radio"
        name="scope"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="size-4 accent-blue-600"
      />
      <span>
        {label}
        <span className="text-gray-500">
          {" "}
          · {count.toLocaleString()} {count === 1 ? "payment" : "payments"}
        </span>
      </span>
    </label>
  )
}
