import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPinned, PawPrint, Plus, SearchX } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useUi } from "../lib/ui";
import { cityCenter } from "../lib/geo";
import type { Alert } from "../lib/types";
import { AlertCard } from "../components/AlertCard";
import { CityFields } from "../components/CityFields";
import { COLORS, MapView } from "../components/MapView";

type Filter = "perdido" | "avistado" | "todos";

/** T1 Resgate: mapa e lista dos casos ativos da cidade (RF04). Rota privada. */
export default function Resgate() {
  const { user } = useAuth();
  const { setAccountOpen } = useUi();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>("todos");
  const [city, setCity] = useState({ city: user!.city, uf: user!.uf });
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [items, setItems] = useState<Alert[] | null>(null);
  const [err, setErr] = useState("");
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => { setCity({ city: user!.city, uf: user!.uf }); }, [user!.city, user!.uf]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    setCenter(null);
    if (city.city && city.uf) cityCenter(city.city, city.uf).then((c) => alive && setCenter(c));
    return () => { alive = false; };
  }, [city.city, city.uf]);

  useEffect(() => {
    if (!city.city || !city.uf) return;
    let alive = true;
    setItems(null); setErr(""); setFocus(null);
    const qs = new URLSearchParams({ type: filter, city: city.city, uf: city.uf });
    api<Alert[]>(`/alerts?${qs}`).then((r) => alive && setItems(r)).catch((e) => alive && setErr(e instanceof ApiError ? e.message : "Erro ao carregar."));
    return () => { alive = false; };
  }, [filter, city.city, city.uf]);

  const chips: { k: Filter; label: string }[] = [{ k: "todos", label: "Todos" }, { k: "perdido", label: "Perdidos" }, { k: "avistado", label: "Avistados" }];

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-extrabold">Pets perdidos e avistados</h1>
          <p className="text-sm text-stone-600">{city.city ? `Casos ativos em ${city.city}, ${city.uf}` : "Escolha uma cidade"}</p>
        </div>
        <div className="w-full sm:w-[380px]">
          <CityFields idPrefix="resgate" compact city={city.city} uf={city.uf} onChange={(c, u) => setCity({ city: c, uf: u })} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex gap-2" role="tablist">
          {chips.map((c) => (
            <button key={c.k} type="button" role="tab" aria-selected={filter === c.k} onClick={() => setFilter(c.k)}
              className={`h-9 px-4 rounded-full text-sm font-bold border cursor-pointer ${filter === c.k ? "bg-brand-600 text-white border-brand-600" : "bg-white text-stone-700 border-stone-300"}`}>{c.label}</button>
          ))}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={() => setAccountOpen(true)} className="h-9 px-4 rounded-full text-sm font-bold border border-stone-300 bg-white flex items-center gap-2 cursor-pointer"><PawPrint className="w-4 h-4 text-brand-600" />Meus pets e plaquinhas</button>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div>
          <MapView height={380} title={`Casos em ${city.city || "sua cidade"}`} center={center} focusId={focus}
            points={(items ?? []).map((a) => ({ id: a.id, lat: a.lat, lng: a.lng, approximate: a.approximate, color: COLORS[a.type], onClick: () => nav(`/caso/${a.id}`) }))} />
          <p className="text-xs text-stone-500 mt-1 flex items-center gap-1"><MapPinned className="w-3.5 h-3.5 shrink-0" />Os pontos são aproximados (até ~200 m) para proteger a casa de quem publicou.</p>
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
          {items?.map((a) => <AlertCard key={a.id} a={a} active={focus === a.id} onShowOnMap={() => { setFocus(null); setTimeout(() => setFocus(a.id), 0); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}
        </div>
      </div>

      <button type="button" onClick={() => nav("/publicar")} className="fixed bottom-6 right-6 z-[900] btn-accent h-14 px-6 shadow-xl no-print" aria-label="Publicar alerta">
        <Plus className="w-5 h-5" />Publicar alerta
      </button>
    </div>
  );
}
