import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Crosshair, ImagePlus, Search, Siren, X } from "lucide-react";
import { api, ApiError, media, uploadImage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SEXES, SIZES, SPECIES, currentPosition } from "../lib/format";
import { IMAGE_ACCEPT } from "../lib/files";
import { cityCenter } from "../lib/geo";
import * as v from "../lib/validate";
import type { Alert, Pet, Sex, Size, Species } from "../lib/types";
import { CityFields } from "../components/CityFields";
import { LocationPicker } from "../components/MapView";
import { Select } from "../components/Select";
import { useToast } from "../components/Toast";

const STEPS = ["Tipo", "Pet", "Fotos", "Detalhes", "Revisão"];
const opts = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));
const SPECIES_OPTIONS = opts(SPECIES);
const SIZE_OPTIONS = [{ value: "", label: "Não informar" }, ...opts(SIZES)];
const SEX_OPTIONS = [{ value: "", label: "Não informar" }, ...opts(SEXES)];
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
type Errors = Partial<Record<string, string>>;

/** T2 Publicar alerta: fluxo guiado em 5 passos (RF01, RF02, RNF01). */
export default function Publicar() {
  const { user, ready, requireLogin } = useAuth();
  const nav = useNavigate();
  const [search] = useSearchParams();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<"perdido" | "avistado" | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState<string | null>(null);
  const [petChosen, setPetChosen] = useState(false);
  const [images, setImages] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({ animalName: "", species: "cao" as Species, breed: "", color: "", size: "" as Size | "", sex: "" as Sex | "", description: "", reward: "", lastSeenAt: "" });
  const [loc, setLoc] = useState({ city: "", uf: "" });
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) { requireLogin("Entre para publicar um alerta.").then((ok) => !ok && nav("/")); return; }
    setLoc({ city: user.city, uf: user.uf });
    api<Pet[]>("/pets").then((list) => {
      setPets(list);
      // vindo da pagina do pet ("Publicar alerta de perdido"): ja escolhe o pet e pula para as fotos
      const wanted = search.get("pet");
      const p = wanted ? list.find((x) => x.id === wanted && !x.openAlertId) : null;
      if (p) { setType("perdido"); setPetId(p.id); setPetChosen(true); setStep(2); }
    }).catch(() => {});
  }, [ready, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // o mapa abre na cidade escolhida
  useEffect(() => {
    let alive = true;
    if (loc.city && loc.uf) cityCenter(loc.city, loc.uf).then((c) => alive && setCenter(c)); else setCenter(null);
    return () => { alive = false; };
  }, [loc.city, loc.uf]);

  const pet = pets.find((p) => p.id === petId) ?? null;
  const clearError = (...keys: string[]) => setErrors((e) => {
    if (!keys.some((k) => e[k])) return e;
    const n = { ...e };
    keys.forEach((k) => delete n[k]);
    return n;
  });
  const set = (k: keyof typeof f, v: string) => { setF((s) => ({ ...s, [k]: v })); clearError(k); };

  const validate = (s: number): Errors => {
    const e: Errors = {};
    if (s >= 0 && !type) e.type = "Escolha o que aconteceu.";
    if (s >= 1 && type === "perdido" && !petChosen) e.pet = "Escolha um pet ou continue sem pet cadastrado.";
    if (s >= 2 && images.length === 0 && !pet?.photo) e.images = "Adicione pelo menos uma foto.";
    if (s >= 3) {
      if (!f.description.trim()) e.description = "A descrição é obrigatória.";
      else if (f.description.trim().length < 10) e.description = "Descreva um pouco mais (pelo menos 10 caracteres).";
      else if (f.description.length > 1000) e.description = "Use no máximo 1000 caracteres.";
      if (!pet) {
        if (!f.breed.trim()) e.breed = "Informe a raça ou se é SRD.";
        else { const m = v.maxLen(f.breed, 60, "Raça"); if (m) e.breed = m; }
      }
      if (type === "perdido" && !pet) {
        if (!f.animalName.trim()) e.animalName = "Informe o nome do pet.";
        else { const m = v.maxLen(f.animalName, 60, "Nome"); if (m) e.animalName = m; }
      }
      const mc = v.maxLen(f.color, 60, "Cor e sinais"); if (mc) e.color = mc;
      if (!loc.uf) e.uf = "Escolha o estado.";
      if (!loc.city.trim()) e.city = "Escolha a cidade na lista.";
      if (!pos) e.pos = "Marque no mapa onde o pet foi visto pela última vez.";
      if (f.reward.length > 80) e.reward = "Use no máximo 80 caracteres.";
      if (f.lastSeenAt && new Date(f.lastSeenAt).getTime() > Date.now() + 60_000) e.lastSeenAt = "A data não pode ser no futuro.";
    }
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    let n = step + 1;
    if (n === 1 && type === "avistado") n = 2; // avistado nao tem pet cadastrado
    setStep(n);
    window.scrollTo({ top: 0 });
  };
  const back = () => { let n = step - 1; if (n === 1 && type === "avistado") n = 0; if (n < 0) nav(-1); else setStep(n); };

  const addFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const room = 5 - images.length;
    setUploading(true);
    const problems: string[] = [];
    try {
      const chosen = Array.from(files);
      if (chosen.length > room) problems.push(`Cabem só mais ${room} ${room === 1 ? "foto" : "fotos"}; as demais foram ignoradas.`);
      for (const file of chosen.slice(0, room)) {
        try {
          const img = await uploadImage(file);
          setImages((s) => [...s, img]);
        } catch (e) { problems.push(e instanceof ApiError ? e.message : `Falha ao enviar "${file.name}".`); }
      }
    } finally { setUploading(false); }
    if (problems.length) setErrors((e) => ({ ...e, images: problems.join(" ") }));
    else clearError("images");
  };

  const useMyLocation = async () => {
    try { const p = await currentPosition(); setPos([p.coords.latitude, p.coords.longitude]); clearError("pos"); }
    catch (e) { toast((e as Error).message, "error"); }
  };

  const publish = async () => {
    const e = validate(4);
    setErrors(e);
    if (Object.keys(e).length) { toast("Revise os campos obrigatórios.", "error"); return; }
    setBusy(true); setDup(null);
    try {
      const a = await api<Alert & { notified: number }>("/alerts", {
        body: {
          type, petId, animalName: f.animalName || null, species: f.species, breed: f.breed || null, color: f.color || null,
          size: f.size || null, sex: f.sex || null, description: f.description, reward: type === "perdido" && f.reward ? f.reward : null,
          city: loc.city, uf: loc.uf, lat: pos![0], lng: pos![1], lastSeenAt: f.lastSeenAt ? new Date(f.lastSeenAt).toISOString() : null,
          imageIds: images.map((i) => i.id),
        },
      });
      toast(a.notified ? `Alerta publicado. ${a.notified} ${a.notified === 1 ? "pessoa da cidade foi avisada" : "pessoas da cidade foram avisadas"}.` : "Alerta publicado no mapa da cidade.");
      nav(`/caso/${a.id}`, { replace: true });
    } catch (er) {
      if (er instanceof ApiError && er.status === 409) setDup(er.data?.existingId ?? null);
      toast(er instanceof ApiError ? er.message : "Não foi possível publicar.", "error");
    } finally { setBusy(false); }
  };

  if (!user) return null;
  const total = type === "avistado" ? 4 : 5;
  const shownStep = type === "avistado" ? Math.max(1, step) : step + 1;

  return (
    <div className="max-w-xl mx-auto pb-10">
      <button type="button" onClick={back} className="flex items-center gap-1 text-sm font-semibold text-stone-600 mb-2 cursor-pointer"><ArrowLeft className="w-4 h-4" />Voltar</button>
      <h1 className="text-2xl font-extrabold">Publicar alerta</h1>
      <p className="text-sm text-stone-600">Passo {shownStep} de {total} · {STEPS[step]}</p>
      <div className="h-1.5 bg-stone-200 rounded-full mt-2 mb-5"><div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${(shownStep / total) * 100}%` }} /></div>

      {step === 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {([["perdido", "Perdi meu pet", "Avise a cidade e receba pistas.", Siren], ["avistado", "Vi um pet", "Achei ou vi um animal sem dono.", Search]] as const).map(([k, t, d, Icon]) => (
            <button key={k} type="button" onClick={() => { setType(k); setErrors({}); }}
              className={`card p-5 text-left cursor-pointer border-2 ${type === k ? "border-brand-600 bg-brand-50" : "border-transparent"}`}>
              <Icon className={`w-7 h-7 ${k === "perdido" ? "text-red-600" : "text-brand-600"}`} />
              <p className="font-extrabold text-lg mt-2">{t}</p>
              <p className="text-sm text-stone-600">{d}</p>
            </button>
          ))}
          {errors.type && <p className="field-error">{errors.type}</p>}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <p className="text-sm text-stone-600">Escolha o pet cadastrado: os dados e a foto dele preenchem o alerta.</p>
          {pets.map((p) => (
            <button key={p.id} type="button" disabled={!!p.openAlertId} onClick={() => { setPetId(p.id); setPetChosen(true); clearError("pet"); }}
              className={`card w-full p-3 flex items-center gap-3 text-left cursor-pointer border-2 disabled:opacity-60 ${petId === p.id ? "border-brand-600" : "border-transparent"}`}>
              {p.photo ? <img src={media(p.photo)} className="w-12 h-12 rounded-xl object-cover" alt="" /> : <div className="w-12 h-12 rounded-xl bg-stone-200" />}
              <div className="flex-1"><p className="font-semibold">{p.name}</p><p className="text-xs text-stone-500">{SPECIES[p.species]} · {p.breed}</p></div>
              {p.openAlertId && <span className="text-xs font-semibold text-amber-700">Já tem alerta ativo</span>}
            </button>
          ))}
          <button type="button" onClick={() => { setPetId(null); setPetChosen(true); clearError("pet"); }}
            className={`card w-full p-4 text-left font-semibold cursor-pointer border-2 ${petChosen && !petId ? "border-brand-600" : "border-transparent"}`}>
            Meu pet não está cadastrado
          </button>
          {errors.pet && <p className="field-error">{errors.pet}</p>}
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="label">Fotos * <span className="font-normal text-stone-500">(até 5, JPG, PNG ou WEBP; a primeira aparece no mapa e no cartaz)</span></p>
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div key={img.id} className="relative aspect-square">
                <img src={media(img.url)} className="w-full h-full object-cover rounded-xl" alt="" />
                <button type="button" aria-label="Remover foto" onClick={() => setImages((s) => s.filter((i) => i.id !== img.id))} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {images.length < 5 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-500 cursor-pointer hover:bg-stone-100">
                <ImagePlus className="w-7 h-7" /><span className="text-xs font-semibold mt-1">{uploading ? "Enviando..." : "Adicionar"}</span>
                <input type="file" accept={IMAGE_ACCEPT} multiple className="hidden" disabled={uploading} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
          {pet?.photo && images.length === 0 && <p className="text-sm text-stone-600 mt-2">Sem fotos novas, usaremos a foto do perfil de {pet.name}.</p>}
          {errors.images && <p className="field-error">{errors.images}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {!pet && (
            <>
              {type === "perdido" && (
                <div><label className="label" htmlFor="n">Nome do pet *</label><input id="n" className={`input ${errors.animalName ? "!border-red-500" : ""}`} maxLength={60} value={f.animalName} onChange={(e) => set("animalName", e.target.value)} />{errors.animalName && <p className="field-error">{errors.animalName}</p>}</div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label" htmlFor="s">Espécie *</label><Select id="s" value={f.species} options={SPECIES_OPTIONS} onChange={(val) => set("species", val)} /></div>
                <div><label className="label" htmlFor="b">Raça *</label><input id="b" className={`input ${errors.breed ? "!border-red-500" : ""}`} maxLength={60} placeholder="Ou SRD" value={f.breed} onChange={(e) => set("breed", e.target.value)} />{errors.breed && <p className="field-error">{errors.breed}</p>}</div>
              </div>
            </>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1"><label className="label" htmlFor="c">Cor e sinais</label><input id="c" className={`input ${errors.color ? "!border-red-500" : ""}`} maxLength={60} value={f.color} onChange={(e) => set("color", e.target.value)} />{errors.color && <p className="field-error">{errors.color}</p>}</div>
            <div><label className="label" htmlFor="sz">Porte</label><Select id="sz" value={f.size} options={SIZE_OPTIONS} placeholder="Não informar" onChange={(val) => set("size", val)} /></div>
            <div><label className="label" htmlFor="sx">Sexo</label><Select id="sx" value={f.sex} options={SEX_OPTIONS} placeholder="Não informar" onChange={(val) => set("sex", val)} /></div>
          </div>
          <div><label className="label" htmlFor="d">Descrição *</label><textarea id="d" rows={3} maxLength={1000} className={`input ${errors.description ? "!border-red-500" : ""}`} placeholder="Coleira, comportamento, onde costuma ir..." value={f.description} onChange={(e) => set("description", e.target.value)} /><p className="text-xs text-stone-400 text-right">{f.description.length}/1000</p>{errors.description && <p className="field-error">{errors.description}</p>}</div>
          {type === "perdido" && (
            <div><label className="label" htmlFor="r">Recompensa <span className="font-normal text-stone-500">(opcional)</span></label><input id="r" className="input" maxLength={80} placeholder="Ex.: R$ 200" value={f.reward} onChange={(e) => set("reward", e.target.value)} />{errors.reward && <p className="field-error">{errors.reward}</p>}</div>
          )}
          <div><label className="label" htmlFor="w">Quando foi visto pela última vez?</label><input id="w" type="datetime-local" max={nowLocal()} className={`input ${errors.lastSeenAt ? "!border-red-500" : ""}`} value={f.lastSeenAt} onChange={(e) => set("lastSeenAt", e.target.value)} />{errors.lastSeenAt && <p className="field-error">{errors.lastSeenAt}</p>}</div>
          <CityFields idPrefix="pub" city={loc.city} uf={loc.uf} onChange={(city, uf) => { setLoc({ city, uf }); clearError("city", "uf"); }} errors={{ city: errors.city, uf: errors.uf }} />
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="label mb-0">Onde foi visto pela última vez? *</span>
              <button type="button" onClick={useMyLocation} className="text-sm font-bold text-brand-600 flex items-center gap-1 cursor-pointer"><Crosshair className="w-4 h-4" />Usar minha localização</button>
            </div>
            <LocationPicker value={pos} center={center} onChange={(lat, lng) => { setPos([lat, lng]); clearError("pos"); }} />
            <p className="text-xs text-stone-500 mt-1">Toque no mapa para marcar. Só você vê o ponto exato; os outros veem um ponto aproximado.</p>
            {errors.pos && <p className="field-error">{errors.pos}</p>}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card p-4 space-y-2">
          <div className="flex gap-3">
            <img src={media(images[0]?.url ?? pet?.photo)} className="w-24 h-24 rounded-xl object-cover bg-stone-200" alt="" />
            <div>
              <p className={`chip ${type === "perdido" ? "bg-red-100 text-red-700" : "bg-brand-100 text-brand-700"}`}>{type === "perdido" ? "Perdido" : "Avistado"}</p>
              <p className="font-extrabold text-lg">{pet?.name ?? (f.animalName || `${SPECIES[f.species]} avistado`)}</p>
              <p className="text-sm text-stone-600">{pet ? `${SPECIES[pet.species]} · ${pet.breed}` : `${SPECIES[f.species]} · ${f.breed}`}</p>
              <p className="text-sm text-stone-600">{loc.city}, {loc.uf}</p>
            </div>
          </div>
          <p className="text-sm">{f.description}</p>
          {f.reward && type === "perdido" && <p className="text-sm font-semibold text-orange-700">Recompensa: {f.reward}</p>}
          <p className="text-xs text-stone-500">Ao publicar, avisaremos quem mora em {loc.city} e aceitou receber alertas.</p>
          {dup && <Link to={`/caso/${dup}`} className="block text-sm font-bold text-brand-600">Ver o alerta ativo deste pet</Link>}
        </div>
      )}

      <div className="flex gap-2 mt-6">
        {step < 4
          ? <button type="button" className="btn-primary flex-1" onClick={next} disabled={uploading}>Continuar</button>
          : <button type="button" className="btn-accent flex-1" onClick={publish} disabled={busy}>{busy ? "Publicando..." : "Publicar alerta"}</button>}
      </div>
    </div>
  );
}
