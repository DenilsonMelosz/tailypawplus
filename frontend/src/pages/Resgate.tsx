import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, SearchX } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { UFS } from "../lib/format";
import type { Alert } from "../lib/types";
import { AlertCard } from "../components/AlertCard";
import { COLORS, MapView } from "../components/MapView";

type Filter = "perdido" | "avistado" | "todos";

/** T1 Resgate: mapa e lista dos casos ativos da cidade (RF04). */
export default function Resgate() {
  const { user, ready, requireLogin } = useAuth();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>("todos");
  const [city, setCity] = useState({ city: "Salvador", uf: "BA" });
  const [items, setItems] = useState<Alert[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { if (user) setCity({ city: user.city, uf: user.uf }); }, [user]);

  useEffect(() => {
    if (!ready) return;
    setItems(null); setErr("");
    const qs = new URLSearchParams({ type: filter, city: city.city, uf: city.uf });
    api<Alert[]>(`/alerts?${qs}`).then(setItems).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro ao carregar."));
  }, [filter, city.city, city.uf, ready]);

  const publish = async () => {
    if (await requireLogin("Entre ou crie sua conta para publicar um alerta.")) nav("/publicar");
  };

  const chips: { k: Filter; label: string }[] = [{ k: "todos", label: "Todos" }, { k: "perdido", label: "Perdidos" }, { k: "avistado", label: "Avistados" }];

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-extrabold">Pets perdidos e avistados</h1>
          <p className="text-sm text-stone-600">Casos ativos em {city.city}, {city.uf}</p>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setCity({ city: String(f.get("c")).trim() || city.city, uf: String(f.get("u")) }); }}>
          <input name="c" defaultValue={city.city} key={city.city} className="input h-10 w-36" aria-label="Cidade" />
          <select name="u" defaultValue={city.uf} key={city.uf} className="input h-10 w-20" aria-label="UF">{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          <button className="btn-ghost h-10">Ver</button>
        </form>
      </div>

      <div className="flex gap-2 mb-3" role="tablist">
        {chips.map((c) => (
          <button key={c.k} type="button" role="tab" aria-selected={filter === c.k} onClick={() => setFilter(c.k)}
            className={`h-9 px-4 rounded-full text-sm font-bold border cursor-pointer ${filter === c.k ? "bg-brand-600 text-white border-brand-600" : "bg-white text-stone-700 border-stone-300"}`}>{c.label}</button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div>
          <MapView height={340} points={(items ?? []).map((a) => ({ id: a.id, lat: a.lat, lng: a.lng, approximate: a.approximate, color: COLORS[a.type], onClick: () => nav(`/caso/${a.id}`) }))} />
          <p className="text-xs text-stone-500 mt-1">Os pontos são aproximados (até ~200 m) para proteger a casa de quem publicou.</p>
        </div>
        <div className="space-y-3">
          {err && <p className="field-error">{err}</p>}
          {!items && !err && [0, 1, 2].map((i) => <div key={i} className="card h-[120px] animate-pulse bg-stone-100" />)}
          {items?.length === 0 && (
            <div className="card p-6 text-center text-stone-600">
              <SearchX className="w-8 h-8 mx-auto text-stone-400" />
              <p className="font-semibold mt-2">Nenhum caso ativo nesta cidade.</p>
              <p className="text-sm">Perdeu ou viu um pet? Publique um alerta.</p>
            </div>
          )}
          {items?.map((a) => <AlertCard key={a.id} a={a} />)}
        </div>
      </div>

      <button type="button" onClick={publish} className="fixed bottom-6 right-6 z-[900] btn-accent h-14 px-6 shadow-xl no-print" aria-label="Publicar alerta">
        <Plus className="w-5 h-5" />Publicar alerta
      </button>
    </div>
  );
}
