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

type Scope = "filtered" | "all"

export interface ExportDialogProps {
  /** The current filter query string, forwarded to the export route as-is. */
  query: string
  columns: { id: string; label: string }[]
  defaultColumns: string[]
  counts: Record<Scope, number>
  filenames: Record<Scope, string>
}

const SCOPE_LABELS: Record<Scope, string> = {
  filtered: "Current filter",
  all: "All payments",
}

const plural = (n: number) => `${n.toLocaleString()} ${n === 1 ? "row" : "rows"}`

export function ExportDialog({
  query,
  columns,
  defaultColumns,
  counts,
  filenames,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("filtered")
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultColumns),
  )

  const reset = () => {
    setScope("filtered")
    setSelected(new Set(defaultColumns))
  }

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Keep the dialog's order, which matches the table's, not the click order.
  const chosen = columns.map((c) => c.id).filter((id) => selected.has(id))

  const params = new URLSearchParams(query)
  params.delete("page")
  params.set("scope", scope)
  params.set("columns", chosen.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) reset()
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
          <DrawerDescription>
            Choose what goes in the CSV. Card last four is off unless you add it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            {(["filtered", "all"] as const).map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-gray-800 has-[:checked]:dark:border-blue-500 has-[:checked]:dark:bg-blue-500/10"
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className="size-4 accent-blue-500"
                />
                <span className="flex-1 text-gray-900 dark:text-gray-50">
                  {SCOPE_LABELS[value]}
                </span>
                <span className="tabular-nums text-gray-500">
                  {plural(counts[value])}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <div className="mb-1 flex items-center justify-between">
              <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
                Columns
              </legend>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => setSelected(new Set(columns.map((c) => c.id)))}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(column.id)}
                    onChange={() => toggle(column.id)}
                    className="size-4 accent-blue-500"
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900">
            <p className="text-gray-900 dark:text-gray-50">
              {plural(counts[scope])} · {chosen.length}{" "}
              {chosen.length === 1 ? "column" : "columns"}
            </p>
            <p className="mt-0.5 break-all font-mono text-xs text-gray-500">
              {filenames[scope]}
            </p>
          </div>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2">
          {chosen.length === 0 && (
            <p id="export-hint" className="text-sm text-gray-500 sm:mr-auto">
              Choose at least one column.
            </p>
          )}
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {chosen.length === 0 ? (
            <Button
              variant="primary"
              className="w-full sm:w-fit"
              disabled
              aria-describedby="export-hint"
            >
              Download CSV
            </Button>
          ) : (
            <Button variant="primary" className="w-full sm:w-fit" asChild>
              <a href={href} onClick={() => setOpen(false)}>
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
