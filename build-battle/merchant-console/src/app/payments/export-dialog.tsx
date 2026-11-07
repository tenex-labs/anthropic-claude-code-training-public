"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
// Type-only: the csv module is server-only (it pulls in the store).
import type { ExportColumn, ExportScope } from "@/lib/csv"
import { Download } from "lucide-react"
import { useId, useRef, useState } from "react"

export type ExportColumnOption = {
  id: ExportColumn
  label: string
  defaultOn: boolean
}

type ExportDialogProps = {
  /** Current URL params with page, scope, and columns already removed. */
  query: string
  /** Every column in canonical order, with its label and default. */
  columns: ExportColumnOption[]
  counts: Record<ExportScope, number>
  filenames: Record<ExportScope, string>
}

const SCOPES: { id: ExportScope; label: string }[] = [
  { id: "current", label: "Current filter" },
  { id: "all", label: "All payments" },
]

function plural(count: number, word: string) {
  return `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`
}

export function ExportDialog({ query, columns, counts, filenames }: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(columns.filter((c) => c.defaultOn).map((c) => c.id)),
  )
  const [scope, setScope] = useState<ExportScope>("current")
  const firstCheckbox = useRef<HTMLInputElement>(null)
  const hintId = useId()

  // Canonical order, not click order, so files stay comparable between exports.
  const ordered = columns.filter((c) => selected.has(c.id)).map((c) => c.id)
  const canDownload = ordered.length > 0

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", ordered.join(","))
  const href = `/api/payments/export?${params.toString()}`

  const toggle = (id: ExportColumn) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>

      <DialogContent
        onOpenAutoFocus={(event) => {
          // Radix would focus the header close button; start on the first choice.
          event.preventDefault()
          firstCheckbox.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>Choose what goes into the CSV.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {columns.map((column, index) => (
                <div key={column.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      ref={index === 0 ? firstCheckbox : undefined}
                      type="checkbox"
                      className="size-4 accent-blue-500"
                      checked={selected.has(column.id)}
                      onChange={() => toggle(column.id)}
                    />
                    {column.label}
                  </label>
                  {column.id === "last4" && (
                    <p className="ml-6 mt-0.5 text-xs text-gray-500">
                      Off by default for files that go to merchants.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-3 space-y-2">
              {SCOPES.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    className="size-4 accent-blue-500"
                    checked={scope === option.id}
                    onChange={() => setScope(option.id)}
                  />
                  {option.label}
                  <span className="text-gray-500">
                    · {plural(counts[option.id], "payment")}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div
            className="rounded-md border border-gray-200 p-3 text-sm dark:border-gray-800"
            aria-live="polite"
          >
            <p className="text-gray-900 dark:text-gray-50">
              {plural(counts[scope], "row")} · {plural(ordered.length, "column")}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-gray-500">
              {filenames[scope]}
            </p>
            {counts[scope] === 0 && (
              <p className="mt-1 text-xs text-gray-500">
                No payments match. The file will contain the header row only.
              </p>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-0">
          {!canDownload && (
            <p id={hintId} className="self-center text-sm text-red-600 sm:mr-auto dark:text-red-500">
              Select at least one column.
            </p>
          )}
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          {canDownload ? (
            <Button variant="primary" asChild>
              <a
                href={href}
                download
                onClick={() => {
                  // Let the browser start the download before the panel unmounts the link.
                  setTimeout(() => setOpen(false), 0)
                }}
              >
                Download
              </a>
            </Button>
          ) : (
            // aria-disabled, not disabled: stays focusable so the hint is announced.
            <Button
              variant="primary"
              aria-disabled="true"
              aria-describedby={hintId}
              onClick={(event) => event.preventDefault()}
              className="cursor-not-allowed bg-blue-300 hover:bg-blue-300 dark:bg-blue-800 dark:text-blue-400 dark:hover:bg-blue-800"
            >
              Download
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
