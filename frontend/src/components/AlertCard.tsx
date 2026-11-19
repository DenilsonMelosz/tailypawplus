import { Link } from "react-router-dom";
import { Crosshair, MapPin } from "lucide-react";
import { media } from "../lib/api";
import { SPECIES, SIZES, ago, alertTitle } from "../lib/format";
import type { Alert } from "../lib/types";

export function TypeChip({ a }: { a: Pick<Alert, "type" | "status"> }) {
  if (a.status === "resolvido") return <span className="chip bg-stone-200 text-stone-700">Devolvido / Resolvido</span>;
  if (a.status === "arquivado") return <span className="chip bg-amber-100 text-amber-800">Arquivado</span>;
  return a.type === "perdido"
    ? <span className="chip bg-red-100 text-red-700">Perdido</span>
    : <span className="chip bg-brand-100 text-brand-700">Avistado</span>;
}

/** Cartao do caso. Com onShowOnMap, ganha o botao "Ver no mapa" (leva o mapa ate o ponto). */
export function AlertCard({ a, onShowOnMap, active = false }: { a: Alert; onShowOnMap?: () => void; active?: boolean }) {
  return (
    <div className={`card flex items-stretch hover:shadow-md transition-shadow ${active ? "ring-2 ring-brand-500" : ""}`}>
      <Link to={`/caso/${a.id}`} className="p-3 flex gap-3 flex-1 min-w-0">
        <img src={media(a.images[0])} alt={alertTitle(a)} className="w-24 h-24 rounded-xl object-cover bg-stone-200 shrink-0" loading="lazy" />
        <div className="min-w-0 flex-1">
          <TypeChip a={a} />
          <p className="font-bold mt-1 truncate">{alertTitle(a)}</p>
          <p className="text-sm text-stone-600 truncate">{[SPECIES[a.species], a.breed, a.size ? SIZES[a.size] : null].filter(Boolean).join(" · ")}</p>
          <p className="text-xs text-stone-500 mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{a.city}, {a.uf} · {ago(a.createdAt)}</p>
        </div>
      </Link>
      {onShowOnMap && (
        <button type="button" onClick={onShowOnMap} aria-label={`Ver ${alertTitle(a)} no mapa`} title="Ver no mapa"
          className="w-12 shrink-0 border-l border-stone-100 text-brand-600 hover:bg-brand-50 rounded-r-2xl flex items-center justify-center cursor-pointer">
          <Crosshair className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
