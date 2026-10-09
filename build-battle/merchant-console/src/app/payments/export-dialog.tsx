"use client"

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
import { Button } from "@/components/Button"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created date",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

type ExportScope = "current" | "all"

export function PaymentsExportDialog({
  query,
  currentCount,
  allCount,
}: {
  query: string
  currentCount: number
  allCount: number
}) {
  const [selectedColumns, setSelectedColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("current")

  const toggleColumn = (column: ExportColumn, checked: boolean) => {
    setSelectedColumns((current) => {
      const next = new Set(current)
      if (checked) next.add(column)
      else next.delete(column)
      return EXPORT_COLUMNS.filter((candidate) => next.has(candidate))
    })
  }

  const download = () => {
    if (selectedColumns.length === 0) return

    const params = new URLSearchParams(query)
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", selectedColumns.join(","))
    window.location.assign(`/api/payments/export?${params.toString()}`)
  }

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
          <div>
            <DrawerTitle>Export payments</DrawerTitle>
            <DrawerDescription>
              Choose the columns and payment scope for your CSV download.
            </DrawerDescription>
          </div>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => {
                const checked = selectedColumns.includes(column)
                return (
                  <label
                    key={column}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        toggleColumn(column, event.target.checked)
                      }
                      className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {COLUMN_LABELS[column]}
                    {column === "last4" && (
                      <span className="text-xs text-gray-500">off by default</span>
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="export-scope"
                  value="current"
                  checked={scope === "current"}
                  onChange={() => setScope("current")}
                  className="mt-0.5 size-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block font-medium">Current filter</span>
                  <span className="text-gray-500">
                    {currentCount.toLocaleString()} payments match the current filters
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="export-scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="mt-0.5 size-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block font-medium">All payments</span>
                  <span className="text-gray-500">
                    {allCount.toLocaleString()} payments in the store
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          <Button type="button" disabled={selectedColumns.length === 0} onClick={download}>
            Download CSV
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
