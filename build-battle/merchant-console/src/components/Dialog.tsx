// Dialog, following the Tremor Drawer pattern in ./Drawer.tsx.
// Radix handles the accessible name (DialogTitle), focus trap, focus return
// on close, and Escape to close.

import * as DialogPrimitives from "@radix-ui/react-dialog"
import { RiCloseLine } from "@remixicon/react"
import * as React from "react"

import { cx, focusRing } from "@/lib/utils"

import { Button } from "./Button"

const Dialog = (
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitives.Root>,
) => {
  return <DialogPrimitives.Root tremor-id="tremor-raw" {...props} />
}
Dialog.displayName = "Dialog"

const DialogTrigger = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Trigger>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Trigger ref={ref} className={cx(className)} {...props} />
))
DialogTrigger.displayName = "Dialog.Trigger"

const DialogClose = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Close>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Close ref={ref} className={cx(className)} {...props} />
))
DialogClose.displayName = "Dialog.Close"

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Content>
>(({ className, ...props }, forwardedRef) => {
  return (
    <DialogPrimitives.Portal>
      <DialogPrimitives.Overlay
        className={cx(
          "fixed inset-0 z-50 overflow-y-auto bg-black/30",
          "data-[state=closed]:animate-hide",
        )}
      >
        <DialogPrimitives.Content
          ref={forwardedRef}
          className={cx(
            // base
            "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-md border p-4 shadow-lg focus:outline-none sm:p-6",
            // border color
            "border-gray-200 dark:border-gray-900",
            // background color
            "bg-white dark:bg-[#090E1A]",
            // transition
            "data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-hide",
            focusRing,
            className,
          )}
          {...props}
        />
      </DialogPrimitives.Overlay>
    </DialogPrimitives.Portal>
  )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className="flex items-start justify-between gap-x-4 border-b border-gray-200 pb-4 dark:border-gray-900"
      {...props}
    >
      <div className={cx("mt-1 flex flex-col gap-y-1", className)}>
        {children}
      </div>
      <DialogPrimitives.Close asChild>
        <Button
          variant="ghost"
          className="aspect-square p-1 hover:bg-gray-100 hover:dark:bg-gray-400/10"
          aria-label="Close"
        >
          <RiCloseLine className="size-6" aria-hidden="true" />
        </Button>
      </DialogPrimitives.Close>
    </div>
  )
})
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Title>
>(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Title
    ref={forwardedRef}
    className={cx(
      "text-base font-semibold text-gray-900 dark:text-gray-50",
      className,
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Description>
>(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Description
    ref={forwardedRef}
    className={cx("text-sm text-gray-500 dark:text-gray-500", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cx("flex-1 py-4", className)} {...props} />
))
DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cx(
      "flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-end dark:border-gray-900",
      className,
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
