import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";

export interface Option { value: string; label: string }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Lista de escolha propria (no lugar do select do navegador). A pessoa so escolhe
 * um item da lista: o texto de "Filtrar" apenas encurta a lista, nunca vira o valor.
 */
export function Select({ id, value, onChange, options, placeholder = "Escolha", searchable = false, disabled = false, loading = false, invalid = false, ariaLabel, emptyText = "Nenhum item encontrado.", className = "" }: {
  id?: string; value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string; searchable?: boolean;
  disabled?: boolean; loading?: boolean; invalid?: boolean; ariaLabel?: string; emptyText?: string; className?: string;
}) {
  const uid = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ left: number; top: number; width: number; maxH: number; up: boolean } | null>(null);

  const shown = useMemo(() => {
    const f = norm(filter.trim());
    return f ? options.filter((o) => norm(o.label).includes(f)) : options;
  }, [options, filter]);
  const current = options.find((o) => o.value === value);

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    const maxH = Math.max(160, Math.min(320, up ? above : below));
    setBox({ left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 220) - 8)), top: up ? r.top - 6 : r.bottom + 6, width: Math.max(r.width, 220), maxH, up });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) place(); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("resize", place); window.removeEventListener("scroll", onScroll, true); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setFilter("");
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(i);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActive(0); }, [filter]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, box]);

  const choose = (v: string) => { onChange(v); setOpen(false); btn.current?.focus(); };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { if (open) { e.stopPropagation(); setOpen(false); btn.current?.focus(); } return; }
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); const o = shown[active]; if (o) choose(o.value); }
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <>
      <button
        ref={btn} id={id} type="button" disabled={disabled || loading} onClick={() => setOpen((v) => !v)} onKeyDown={onKey}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={`${uid}-list`} aria-label={ariaLabel} aria-invalid={invalid || undefined}
        className={`input flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${invalid ? "!border-red-500" : ""} ${className}`}
      >
        <span className={`truncate ${current ? "" : "text-stone-400"}`}>{loading ? "Carregando..." : current?.label ?? placeholder}</span>
        {loading ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-stone-400" /> : <ChevronDown className={`w-4 h-4 shrink-0 text-stone-500 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && box && createPortal(
        <div
          ref={panel} onKeyDown={onKey}
          style={{ position: "fixed", left: box.left, width: box.width, ...(box.up ? { bottom: window.innerHeight - box.top } : { top: box.top }), maxHeight: box.maxH, zIndex: 3000 }}
          className="flex flex-col bg-white rounded-2xl border border-stone-200 shadow-2xl overflow-hidden no-print"
        >
          {searchable && (
            <div className="p-2 border-b border-stone-100 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar a lista" aria-label="Filtrar a lista"
                  className="w-full h-10 rounded-xl bg-stone-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand-100" />
              </div>
            </div>
          )}
          <ul ref={listRef} id={`${uid}-list`} role="listbox" aria-label={ariaLabel} className="overflow-y-auto py-1 overscroll-contain">
            {shown.length === 0 && <li className="px-4 py-3 text-sm text-stone-500">{emptyText}</li>}
            {shown.map((o, i) => {
              const sel = o.value === value;
              return (
                <li key={o.value} data-i={i} role="option" aria-selected={sel} onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o.value)}
                  className={`mx-1 px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 cursor-pointer text-[15px] ${i === active ? "bg-brand-50" : ""} ${sel ? "font-bold text-brand-700" : ""}`}>
                  <span className="truncate">{o.label}</span>
                  {sel && <Check className="w-4 h-4 shrink-0 text-brand-600" />}
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}
