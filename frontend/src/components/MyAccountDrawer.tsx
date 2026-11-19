import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, ImagePlus, Plus, Printer, QrCode, Scissors } from "lucide-react";
import { Modal } from "./Modal";
import { CityFields } from "./CityFields";
import { Select } from "./Select";
import { siteUrl } from "./QrImage";
import { useAuth } from "../lib/auth";
import { api, ApiError, media, uploadImage } from "../lib/api";
import { IMAGE_ACCEPT } from "../lib/files";
import { SPECIES, alertTitle, ago } from "../lib/format";
import type { Alert, Pet, Species, User } from "../lib/types";
import { useToast } from "./Toast";
import { printTag } from "../lib/print";
import { svgToDataUrl, tagSvg } from "../lib/tagArt";
import * as v from "../lib/validate";

const STATUS: Record<Alert["status"], string> = { aberto: "Ativo", resolvido: "Resolvido", arquivado: "Arquivado" };
const SPECIES_OPTIONS = Object.entries(SPECIES).map(([value, label]) => ({ value, label }));

/** Painel lateral (nao e uma tela): meus pets e plaquinhas, meus alertas e preferencias. */
export function MyAccountDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, update, logout } = useAuth();
  const toast = useToast();
  const [pets, setPets] = useState<Pet[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [adding, setAdding] = useState(false);
  const [tagFor, setTagFor] = useState<Pet | null>(null);
  const [pref, setPref] = useState({ city: user?.city ?? "", uf: user?.uf ?? "", receiveAlerts: user?.receiveAlerts ?? true });
  const [prefErr, setPrefErr] = useState<Record<string, string>>({});

  const load = () => {
    api<Pet[]>("/pets").then(setPets).catch(() => {});
    api<Alert[]>("/alerts/mine").then(setAlerts).catch(() => {});
  };
  useEffect(() => { if (open) { load(); if (user) setPref({ city: user.city, uf: user.uf, receiveAlerts: user.receiveAlerts }); setPrefErr({}); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePref = async () => {
    const e = v.clean({ uf: pref.uf ? undefined : "Escolha o estado.", city: pref.city ? undefined : "Escolha a cidade na lista." });
    setPrefErr(e);
    if (Object.keys(e).length) return;
    try { update(await api<User>("/me", { method: "PATCH", body: pref })); toast("Preferências salvas."); }
    catch (er) { toast(er instanceof ApiError ? er.message : "Não foi possível salvar.", "error"); }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Olá, ${user?.name.split(" ")[0] ?? ""}`} side>
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold">Meus pets e plaquinhas</h3>
            <button type="button" className="text-sm font-bold text-brand-600 flex items-center gap-1 cursor-pointer" onClick={() => setAdding((s) => !s)}><Plus className="w-4 h-4" />Cadastrar</button>
          </div>
          <p className="text-sm text-stone-600 mb-3">Cadastre o pet e coloque a plaquinha com QR Code na coleira <b>antes</b> de ele se perder: quem o encontrar avisa você na hora.</p>
          {adding && <PetForm onDone={(p) => { setAdding(false); setPets((s) => [...s, p]); setTagFor(p); }} />}
          {pets.length === 0 && !adding && <p className="text-sm text-stone-500">Nenhum pet cadastrado.</p>}
          <ul className="space-y-2">
            {pets.map((p) => (
              <li key={p.id} className="card p-3">
                <div className="flex items-center gap-3">
                  <Link to={`/p/${p.tagCode}`} onClick={onClose} className="shrink-0" aria-label={`Abrir a página de ${p.name}`}>
                    {p.photo ? <img src={media(p.photo)} alt="" className="w-14 h-14 rounded-xl object-cover" /> : <div className="w-14 h-14 rounded-xl bg-stone-200" />}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/p/${p.tagCode}`} onClick={onClose} className="font-semibold truncate block hover:underline">{p.name}</Link>
                    <p className="text-xs text-stone-500">{SPECIES[p.species]} · {p.breed}</p>
                    {p.openAlertId && <p className="text-xs font-bold text-red-600">Alerta ativo</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Link to={`/p/${p.tagCode}`} onClick={onClose} className="btn-ghost h-9 px-3 text-sm"><ExternalLink className="w-4 h-4" />Página do pet</Link>
                  <button type="button" className="btn-ghost h-9 px-3 text-sm" onClick={() => setTagFor(p)}><QrCode className="w-4 h-4" />Plaquinha</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-6">
          <h3 className="font-bold mb-2">Meus alertas</h3>
          {alerts.length === 0 && <p className="text-sm text-stone-500">Você ainda não publicou alertas.</p>}
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id}>
                <Link to={`/caso/${a.id}`} onClick={onClose} className="card p-3 flex items-center gap-3 hover:bg-stone-50">
                  <img src={media(a.images[0])} alt="" className="w-12 h-12 rounded-xl object-cover bg-stone-200" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{alertTitle(a)}</p>
                    <p className="text-xs text-stone-500">{a.type === "perdido" ? "Perdido" : "Avistado"} · {ago(a.createdAt)}</p>
                  </div>
                  <span className={`chip ${a.status === "aberto" ? "bg-green-100 text-green-800" : a.status === "arquivado" ? "bg-amber-100 text-amber-800" : "bg-stone-200 text-stone-700"}`}>{STATUS[a.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-6 space-y-3">
          <h3 className="font-bold">Minha cidade e alertas</h3>
          <CityFields idPrefix="pref" city={pref.city} uf={pref.uf} onChange={(city, uf) => { setPref({ ...pref, city, uf }); setPrefErr({}); }} errors={prefErr} />
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1 w-4 h-4 accent-[#0F7F8C]" checked={pref.receiveAlerts} onChange={(e) => setPref({ ...pref, receiveAlerts: e.target.checked })} />
            <span>Receber alertas de pets perdidos e avistados na minha cidade.</span>
          </label>
          <button type="button" className="btn-primary w-full" onClick={savePref}>Salvar preferências</button>
        </section>

        <button type="button" className="btn-ghost w-full" onClick={() => { logout(); onClose(); }}>Sair da conta</button>
      </Modal>
      <TagModal pet={tagFor} onClose={() => setTagFor(null)} onNavigate={onClose} />
    </>
  );
}

function PetForm({ onDone }: { onDone: (p: Pet) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", species: "cao" as Species, breed: "", color: "" });
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, val: string) => { setF((s) => ({ ...s, [k]: val })); setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; }); };

  const pick = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try { setPhoto(await uploadImage(file)); setErrors((e) => { const n = { ...e }; delete n.photo; return n; }); }
    catch (er) { setErrors((e) => ({ ...e, photo: er instanceof ApiError ? er.message : "Falha ao enviar a foto." })); }
    finally { setUploading(false); }
  };

  const save = async () => {
    const e = v.clean({
      name: f.name.trim() ? v.maxLen(f.name, 60, "Nome") : "Informe o nome do pet.",
      breed: f.breed.trim() ? v.maxLen(f.breed, 60, "Raça") : "Informe a raça ou escreva SRD.",
      color: v.maxLen(f.color, 60, "Cor e sinais"),
    });
    setErrors((old) => ({ ...e, ...(old.photo ? { photo: old.photo } : {}) }));
    if (Object.keys(e).length) return;
    setBusy(true);
    try { onDone(await api<Pet>("/pets", { body: { ...f, name: f.name.trim(), breed: f.breed.trim(), color: f.color.trim() || null, photoId: photo?.id ?? null } })); toast("Pet cadastrado. Imprima a plaquinha!"); }
    catch (er) { toast(er instanceof ApiError ? er.message : "Não foi possível cadastrar.", "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="card p-3 mb-3 space-y-3">
      <div>
        <label className="label" htmlFor="pn">Nome do pet *</label>
        <input id="pn" className={`input ${errors.name ? "!border-red-500" : ""}`} maxLength={60} value={f.name} onChange={(e) => set("name", e.target.value)} />
        {errors.name && <p className="field-error">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="ps">Espécie *</label>
          <Select id="ps" value={f.species} options={SPECIES_OPTIONS} onChange={(val) => set("species", val)} />
        </div>
        <div>
          <label className="label" htmlFor="pb">Raça *</label>
          <input id="pb" className={`input ${errors.breed ? "!border-red-500" : ""}`} maxLength={60} placeholder="Ou SRD" value={f.breed} onChange={(e) => set("breed", e.target.value)} />
          {errors.breed && <p className="field-error">{errors.breed}</p>}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="pc">Cor e sinais</label>
        <input id="pc" className={`input ${errors.color ? "!border-red-500" : ""}`} maxLength={60} value={f.color} onChange={(e) => set("color", e.target.value)} />
        {errors.color && <p className="field-error">{errors.color}</p>}
      </div>
      <div>
        <label className="btn-ghost w-full">
          <ImagePlus className="w-4 h-4" />{uploading ? "Enviando..." : photo ? "Foto adicionada ✓ (trocar)" : "Adicionar foto (JPG, PNG ou WEBP)"}
          <input type="file" accept={IMAGE_ACCEPT} className="hidden" disabled={uploading} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {errors.photo && <p className="field-error">{errors.photo}</p>}
      </div>
      <button type="button" className="btn-primary w-full" disabled={busy || uploading} onClick={save}>{busy ? "Salvando..." : "Salvar pet"}</button>
    </div>
  );
}

function TagModal({ pet, onClose, onNavigate }: { pet: Pet | null; onClose: () => void; onNavigate: () => void }) {
  const [img, setImg] = useState("");
  const url = pet ? siteUrl(`/p/${pet.tagCode}`) : "";
  useEffect(() => {
    if (!pet) return;
    setImg("");
    tagSvg(pet.name, url).then((s) => setImg(svgToDataUrl(s))).catch(() => setImg(""));
  }, [pet?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pet) return null;
  return (
    <Modal open onClose={onClose} title={`Plaquinha de ${pet.name}`}>
      <div className="flex flex-col items-center text-center">
        {img ? <img src={img} alt={`Plaquinha de ${pet.name} com QR Code`} className="w-60 h-60" /> : <div className="w-60 h-60 rounded-full bg-stone-100 animate-pulse" />}
        <p className="text-sm text-stone-600 mt-3">Quem ler o QR abre a <b>página do {pet.name}</b> e pode avisar você com a localização, sem precisar de conta.</p>
        <p className="text-xs text-stone-400 mt-1 break-all">{url}</p>
        <div className="mt-3 rounded-xl bg-stone-50 border border-stone-200 p-3 text-left text-sm text-stone-700 flex gap-2 w-full">
          <Scissors className="w-4 h-4 mt-0.5 shrink-0 text-stone-500" />
          <span>Imprima, recorte no tamanho que caber na coleira e coloque num <b>porta-plaquinha transparente</b> para pendurar.</span>
        </div>
        <div className="flex gap-2 mt-4 w-full">
          <Link className="btn-ghost flex-1" to={`/p/${pet.tagCode}`} onClick={() => { onClose(); onNavigate(); }}><ExternalLink className="w-4 h-4" />Página do pet</Link>
          <button type="button" className="btn-primary flex-1" onClick={() => printTag(pet.name, url)}><Printer className="w-4 h-4" />Imprimir</button>
        </div>
      </div>
    </Modal>
  );
}
