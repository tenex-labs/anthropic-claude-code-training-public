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
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<string, string> = {
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

type Scope = "filter" | "all"

/**
 * Export options for /payments. This only builds the request; the route
 * validates columns and scope and pulls rows from the query builder, so the
 * file is never limited to the page on screen.
 */
export function ExportDialog({
  columns,
  defaultColumns,
  filterQuery,
  counts,
}: {
  columns: readonly string[]
  defaultColumns: readonly string[]
  /** The current filter params, without paging. */
  filterQuery: string
  counts: Record<Scope, number>
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultColumns),
  )
  const [scope, setScope] = useState<Scope>("filter")

  const toggle = (column: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  // Keep the table's column order regardless of click order.
  const chosen = columns.filter((column) => selected.has(column))
  const href = (() => {
    const params = new URLSearchParams(scope === "filter" ? filterQuery : "")
    params.set("scope", scope)
    params.set("columns", chosen.join(","))
    return `/api/payments/export?${params.toString()}`
  })()
  const rowCount = counts[scope]

  return (
    <Drawer>
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
            Choose what goes into the CSV. Card last four is off unless you
            turn it on.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
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
                    className="size-4 accent-blue-500"
                  />
                  {label}
                  <span className="text-gray-500">
                    ({counts[value].toLocaleString()} rows)
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                    className="size-4 accent-blue-500"
                  />
                  {COLUMN_LABELS[column] ?? column}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-sm text-gray-500" aria-live="polite">
            {chosen.length === 0
              ? "Select at least one column to download."
              : `${rowCount.toLocaleString()} rows × ${chosen.length} columns`}
          </p>
        </DrawerBody>

        <DrawerFooter className="gap-2">
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {chosen.length === 0 ? (
            <Button className="py-1.5" disabled>
              Download CSV
            </Button>
          ) : (
            <Button className="py-1.5" asChild>
              <a href={href} download>
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
