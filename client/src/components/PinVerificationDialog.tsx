import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KeyRound, ShieldCheck } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

export function shouldForwardDialogChange(currentOpen: boolean, nextOpen: boolean) {
  return currentOpen !== nextOpen;
}

type PinVerificationDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (pin: string) => void;
};

export function PinVerificationDialog({
  open,
  title = "تأكيد العملية",
  description = "هذه العملية محمية. أدخل الرقم السري للمتابعة.",
  busy = false,
  onOpenChange,
  onConfirm,
}: PinVerificationDialogProps) {
  const [pin, setPin] = useState("");
  const lastOpenState = useRef(open);

  useEffect(() => {
    if (lastOpenState.current === open) return;
    lastOpenState.current = open;
    if (!open) setPin("");
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    // Radix may report the current value while mounting/unmounting. Avoid
    // forwarding a no-op update to the parent of this controlled dialog.
    if (!shouldForwardDialogChange(open, nextOpen)) return;
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-700" />{title}</DialogTitle><DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={event => { event.preventDefault(); if (pin.trim().length >= 4) onConfirm(pin.trim()); }} className="space-y-4">
          <label className="block"><span className="field-label"><KeyRound className="ml-1 inline h-4 w-4" />الرقم السري</span><Input autoFocus type="password" inputMode="numeric" autoComplete="current-password" minLength={4} value={pin} onChange={event => setPin(event.target.value)} placeholder="••••" className="field-input" /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" className="rounded-xl" onClick={() => handleOpenChange(false)}>إلغاء</Button><Button type="submit" disabled={busy || pin.trim().length < 4} className="rounded-xl bg-teal-700 hover:bg-teal-800">{busy ? "جارٍ التحقق…" : "تأكيد"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

