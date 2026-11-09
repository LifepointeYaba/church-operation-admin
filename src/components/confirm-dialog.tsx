"use client"

import { createContext, useCallback, useContext, useRef, useState } from "react"
import { TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ConfirmOptions = {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for deletes and other hard-to-undo actions. */
  destructive?: boolean
  /** The person must type this word (e.g. "ERASE") before confirming. */
  requireText?: string
}
type Confirm = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm>(async () => false)

/** `const confirm = useConfirm(); if (await confirm({ title: "Delete?" })) …` */
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [typed, setTyped] = useState("")
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const confirm = useCallback<Confirm>((o) => new Promise((resolve) => {
    resolver.current?.(false)
    resolver.current = resolve
    setTyped("")
    setOpts(o)
  }), [])
  const close = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOpts(null)
  }
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onOpenChange={(open) => { if (!open) close(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {opts?.destructive && <TriangleAlert className="size-5 text-destructive" aria-hidden />}
              {opts?.title}
            </DialogTitle>
            {opts?.description && <DialogDescription>{opts.description}</DialogDescription>}
          </DialogHeader>
          {opts?.requireText && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-text">Type <b>{opts.requireText}</b> to confirm</Label>
              <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>{opts?.cancelLabel ?? "Cancel"}</Button>
            <Button variant={opts?.destructive ? "destructive" : "default"} onClick={() => close(true)}
              disabled={!!opts?.requireText && typed.trim() !== opts.requireText} autoFocus={!opts?.requireText}>
              {opts?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
