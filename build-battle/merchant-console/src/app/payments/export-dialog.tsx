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
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  type ExportColumn,
} from "@/lib/exportColumns"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Labels for the export columns. Typed against ExportColumn, so adding a
 * column to the serializer fails the build until it gets a label here. The
 * server still validates every name; this list only drives the checkboxes.
 */
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

type Scope = "filter" | "all"

export function ExportDialog({
  filterQuery,
  filteredCount,
  allCount,
}: {
  /** The active filters as a query string, without page. */
  filterQuery: string
  filteredCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ExportColumn[]>([...DEFAULT_EXPORT_COLUMNS])
  const [scope, setScope] = useState<Scope>("filter")

  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, column] : current.filter((c) => c !== column),
    )

  const rowCount = scope === "all" ? allCount : filteredCount
  const nothingSelected = selected.length === 0

  const href = () => {
    const params = new URLSearchParams(scope === "filter" ? filterQuery : "")
    params.set("scope", scope)
    // Keep the order the columns are listed in, not the order they were ticked.
    params.set("columns", EXPORT_COLUMNS.filter((c) => selected.includes(c)).join(","))
    return `/api/payments/export?${params.toString()}`
  }

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

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes in the CSV before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === "filter"}
                  onChange={() => setScope("filter")}
                />
                Current filter
                <span className="text-gray-500 tabular-nums">
                  ({filteredCount.toLocaleString()} payments)
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                All payments
                <span className="text-gray-500 tabular-nums">
                  ({allCount.toLocaleString()} payments)
                </span>
              </label>
            </div>
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
                    checked={selected.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {nothingSelected && (
              <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2 sm:justify-between">
          <p className="text-sm text-gray-500" aria-live="polite">
            {rowCount.toLocaleString()} rows will be exported
          </p>
          {nothingSelected ? (
            <Button disabled className="w-full sm:w-fit">
              Download
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-fit">
              <a href={href()} onClick={() => setOpen(false)}>
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
