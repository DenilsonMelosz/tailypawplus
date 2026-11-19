import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Heart, MapPinned, PawPrint, Plus, QrCode, SearchX, Siren } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useUi } from "../lib/ui";
import { cityCenter } from "../lib/geo";
import type { Alert } from "../lib/types";
import { AlertCard } from "../components/AlertCard";
import { CityFields } from "../components/CityFields";
import { COLORS, MapView } from "../components/MapView";

type Filter = "perdido" | "avistado" | "todos";

/** T1 Resgate. Sem conta: apresentacao e entrada. Com conta: mapa e lista dos casos ativos da cidade (RF04). */
export default function Resgate() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="card h-96 animate-pulse bg-stone-100" />;
  return user ? <Cidade /> : <Entrada />;
}

function Entrada() {
  const { requireLogin } = useAuth();
  const steps = [
    { Icon: Siren, t: "Publique o alerta", d: "Conte o que aconteceu, com fotos e o local. Leva poucos minutos." },
    { Icon: Bell, t: "A cidade é avisada", d: "Quem mora na mesma cidade e aceitou receber alertas é notificado na hora." },
    { Icon: Heart, t: "Combinem a devolução", d: "Conversem pelo aplicativo, sem expor telefone nem endereço." },
  ];
  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-12">
      <div className="text-center">
        <span className="chip bg-brand-100 text-brand-700">Reencontro de pets perdidos</span>
        <h1 className="text-3xl sm:text-5xl font-extrabold mt-3 leading-tight">Todo pet perdido tem uma cidade inteira para ajudar.</h1>
        <p className="text-lg text-stone-600 mt-3 max-w-xl mx-auto">Entre para ver os casos ativos da sua cidade no mapa, publicar um alerta e falar com quem viu o seu pet.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button type="button" className="btn-primary h-12 px-8 text-base" onClick={() => requireLogin("Entre para ver os casos da sua cidade.", "login")}>Entrar</button>
          <button type="button" className="btn-accent h-12 px-8 text-base" onClick={() => requireLogin("Crie sua conta para ver e publicar alertas.", "register")}>Criar conta</button>
        </div>
      </div>

      <ol className="grid sm:grid-cols-3 gap-3 mt-10">
        {steps.map(({ Icon, t, d }, i) => (
          <li key={t} className="card p-5">
            <span className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center"><Icon className="w-5 h-5" /></span>
            <p className="font-extrabold mt-3">{i + 1}. {t}</p>
            <p className="text-sm text-stone-600 mt-1">{d}</p>
          </li>
        ))}
      </ol>

      <div className="card p-5 mt-4 flex gap-4 items-start">
        <span className="w-10 h-10 rounded-full bg-orange-50 text-accent flex items-center justify-center shrink-0"><QrCode className="w-5 h-5" /></span>
        <div>
          <p className="font-extrabold">Achou um pet com a plaquinha na coleira?</p>
          <p className="text-sm text-stone-600">Leia o QR Code com a câmera do celular. A página do pet abre sem precisar de conta, e você avisa o tutor com um toque.</p>
        </div>
      </div>
    </div>
  );
}

function Cidade() {
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
