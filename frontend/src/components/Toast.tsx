import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Kind = "ok" | "error";
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: Kind }[]>([]);
  const show = useCallback((msg: string, kind: Kind = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2 w-[min(92vw,420px)] no-print" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-lg text-white ${i.kind === "error" ? "bg-red-600" : "bg-ink"}`}>{i.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
