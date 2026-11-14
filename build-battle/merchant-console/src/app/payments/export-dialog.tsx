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
import type { ExportColumn, ExportScope } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

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

/**
 * Options for the payments export. The server validates everything again;
 * the checks here only keep ops from asking for a file that cannot exist.
 */
export function ExportDialog({
  query,
  filteredCount,
  allCount,
  columns,
  defaultColumns,
}: {
  query: string
  filteredCount: number
  allCount: number
  columns: readonly ExportColumn[]
  defaultColumns: readonly ExportColumn[]
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([...defaultColumns])
  const [scope, setScope] = useState<ExportScope>("filtered")

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : columns.filter((c) => c === column || current.includes(c)),
    )

  const rowCount = scope === "all" ? allCount : filteredCount
  const href = (() => {
    const params = new URLSearchParams(query)
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", selected.join(","))
    return `/api/payments/export?${params.toString()}`
  })()

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
            Choose what goes into the CSV. Card last four is off by default.
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
                  ["filtered", "Current filter", filteredCount],
                  ["all", "All payments", allCount],
                ] as const
              ).map(([value, label, count]) => (
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
                  <span className="text-gray-500 tabular-nums">
                    ({count.toLocaleString()} payments)
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
                Columns
              </legend>
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  className="text-blue-600 hover:underline dark:text-blue-500"
                  onClick={() => setSelected([...columns])}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-blue-600 hover:underline dark:text-blue-500"
                  onClick={() => setSelected([])}
                >
                  Select none
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-sm text-gray-500" aria-live="polite">
            {selected.length === 0
              ? "Select at least one column to download."
              : `${rowCount.toLocaleString()} rows × ${selected.length} columns`}
          </p>
        </DrawerBody>
        <DrawerFooter className="gap-2">
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {selected.length === 0 ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild>
              <a href={href}>Download</a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
