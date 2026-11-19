import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Crosshair, ImagePlus, Search, Siren, X } from "lucide-react";
import { api, ApiError, media, uploadImage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SEXES, SIZES, SPECIES, currentPosition } from "../lib/format";
import type { Alert, Pet, Sex, Size, Species } from "../lib/types";
import { CityFields } from "../components/CityFields";
import { LocationPicker } from "../components/MapView";
import { useToast } from "../components/Toast";

const STEPS = ["Tipo", "Pet", "Fotos", "Detalhes", "Revisão"];
type Errors = Partial<Record<string, string>>;

/** T2 Publicar alerta: fluxo guiado em 5 passos (RF01, RF02, RNF01). */
export default function Publicar() {
  const { user, ready, requireLogin } = useAuth();
  const nav = useNavigate();
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

  useEffect(() => {
    if (!ready) return;
    if (!user) { requireLogin("Entre para publicar um alerta.").then((ok) => !ok && nav("/")); return; }
    setLoc({ city: user.city, uf: user.uf });
    api<Pet[]>("/pets").then(setPets).catch(() => {});
  }, [ready, user]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (!pet && !f.breed.trim()) e.breed = "Informe a raça ou se é SRD.";
      if (type === "perdido" && !pet && !f.animalName.trim()) e.animalName = "Informe o nome do pet.";
      if (!loc.city.trim()) e.city = "A cidade é obrigatória.";
      if (!loc.uf) e.uf = "O estado (UF) é obrigatório.";
      if (!pos) e.pos = "Marque no mapa onde o pet foi visto pela última vez.";
      if (f.reward.length > 80) e.reward = "Use no máximo 80 caracteres.";
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
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 5 - images.length)) {
        const img = await uploadImage(file);
        setImages((s) => [...s, img]);
        clearError("images");
      }
    } catch (e) { toast(e instanceof ApiError ? e.message : "Falha ao enviar a foto.", "error"); }
    finally { setUploading(false); }
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
          <p className="label">Fotos * <span className="font-normal text-stone-500">(até 5; a primeira aparece no mapa e no cartaz)</span></p>
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
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => addFiles(e.target.files)} />
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
                <div><label className="label" htmlFor="n">Nome do pet *</label><input id="n" className="input" value={f.animalName} onChange={(e) => set("animalName", e.target.value)} />{errors.animalName && <p className="field-error">{errors.animalName}</p>}</div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label" htmlFor="s">Espécie *</label><select id="s" className="input" value={f.species} onChange={(e) => set("species", e.target.value)}>{Object.entries(SPECIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label" htmlFor="b">Raça *</label><input id="b" className="input" placeholder="Ou SRD" value={f.breed} onChange={(e) => set("breed", e.target.value)} />{errors.breed && <p className="field-error">{errors.breed}</p>}</div>
              </div>
            </>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1"><label className="label" htmlFor="c">Cor e sinais</label><input id="c" className="input" value={f.color} onChange={(e) => set("color", e.target.value)} /></div>
            <div><label className="label" htmlFor="sz">Porte</label><select id="sz" className="input" value={f.size} onChange={(e) => set("size", e.target.value)}><option value="">--</option>{Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label" htmlFor="sx">Sexo</label><select id="sx" className="input" value={f.sex} onChange={(e) => set("sex", e.target.value)}><option value="">--</option>{Object.entries(SEXES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div><label className="label" htmlFor="d">Descrição *</label><textarea id="d" rows={3} className="input" placeholder="Coleira, comportamento, onde costuma ir..." value={f.description} onChange={(e) => set("description", e.target.value)} />{errors.description && <p className="field-error">{errors.description}</p>}</div>
          {type === "perdido" && (
            <div><label className="label" htmlFor="r">Recompensa <span className="font-normal text-stone-500">(opcional)</span></label><input id="r" className="input" maxLength={80} placeholder="Ex.: R$ 200" value={f.reward} onChange={(e) => set("reward", e.target.value)} />{errors.reward && <p className="field-error">{errors.reward}</p>}</div>
          )}
          <div><label className="label" htmlFor="w">Quando foi visto pela última vez?</label><input id="w" type="datetime-local" className="input" value={f.lastSeenAt} onChange={(e) => set("lastSeenAt", e.target.value)} /></div>
          <CityFields city={loc.city} uf={loc.uf} onChange={(city, uf) => { setLoc({ city, uf }); clearError("city", "uf"); }} errors={{ city: errors.city, uf: errors.uf }} />
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="label mb-0">Onde foi visto pela última vez? *</span>
              <button type="button" onClick={useMyLocation} className="text-sm font-bold text-brand-600 flex items-center gap-1 cursor-pointer"><Crosshair className="w-4 h-4" />Usar minha localização</button>
            </div>
            <LocationPicker value={pos} onChange={(lat, lng) => { setPos([lat, lng]); clearError("pos"); }} />
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
