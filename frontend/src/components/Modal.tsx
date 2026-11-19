import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Pilha de janelas abertas: o Esc fecha so a que esta na frente. */
const stack: symbol[] = [];

export function Modal({ open, onClose, title, children, side = false }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; side?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const me = Symbol("modal");
    stack.push(me);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stack[stack.length - 1] === me && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); const i = stack.indexOf(me); if (i >= 0) stack.splice(i, 1); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className={`fixed inset-0 z-[1500] flex ${side ? "justify-end" : "items-end sm:items-center justify-center sm:p-4"} no-print`} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/50 cursor-default" />
      <div className={`relative bg-white shadow-2xl flex flex-col ${side ? "h-full w-full max-w-md" : "w-full sm:max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl"}`}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <h2 className="font-extrabold text-lg">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
