"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
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

type Scope = "filter" | "all"

/**
 * Collects options and builds a URL. It holds no rows and does no counting:
 * the file is produced by GET /api/payments/export, and both counts are
 * computed on the server by the same query builder the route uses.
 */
export function ExportDialog({
  columns,
  defaultColumns,
  filterCount,
  allCount,
  filterQuery,
}: {
  columns: string[]
  defaultColumns: string[]
  filterCount: number
  allCount: number
  /** The table's active filters, already serialized (no page param). */
  filterQuery: string
}) {
  const [selected, setSelected] = useState<string[]>(defaultColumns)
  const [scope, setScope] = useState<Scope>("filter")

  const count = scope === "all" ? allCount : filterCount
  const canDownload = selected.length > 0

  const toggle = (column: string) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : [...current, column],
    )

  // Keep the table's column order, whatever order boxes were ticked in.
  const ordered = columns.filter((column) => selected.includes(column))
  const params = new URLSearchParams(filterQuery)
  params.set("scope", scope)
  params.set("columns", ordered.join(","))

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
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes in the CSV. The card last four is off unless you
            turn it on.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="space-y-2">
              {(
                [
                  ["filter", "Current filter", filterCount],
                  ["all", "All payments", allCount],
                ] as const
              ).map(([value, label, rows]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4"
                  />
                  {label}
                  <span className="text-gray-500">
                    ({rows.toLocaleString("en-US")})
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4"
                  />
                  {COLUMN_LABELS[column] ?? column}
                </label>
              ))}
            </div>
            {!canDownload && (
              <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>
        <DrawerFooter className="items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
            {count.toLocaleString("en-US")} {count === 1 ? "row" : "rows"} will
            be exported
          </p>
          {canDownload ? (
            <Button asChild>
              <a href={`/api/payments/export?${params.toString()}`} download>
                Download CSV
              </a>
            </Button>
          ) : (
            <Button disabled>Download CSV</Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
