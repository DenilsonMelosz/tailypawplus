import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Printer, QrCode } from "lucide-react";
import { Modal } from "./Modal";
import { CityFields } from "./CityFields";
import { QrImage, siteUrl } from "./QrImage";
import { useAuth } from "../lib/auth";
import { api, ApiError, media, uploadImage } from "../lib/api";
import { SPECIES, alertTitle, ago } from "../lib/format";
import type { Alert, Pet, Species, User } from "../lib/types";
import { useToast } from "./Toast";
import { printTag } from "../lib/print";

const STATUS: Record<Alert["status"], string> = { aberto: "Ativo", resolvido: "Resolvido", arquivado: "Arquivado" };

/** Painel lateral (nao e uma tela): meus pets e plaquinhas, meus alertas e preferencias. */
export function MyAccountDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, update, logout } = useAuth();
  const toast = useToast();
  const [pets, setPets] = useState<Pet[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [adding, setAdding] = useState(false);
  const [tagFor, setTagFor] = useState<Pet | null>(null);
  const [pref, setPref] = useState({ city: user?.city ?? "", uf: user?.uf ?? "", receiveAlerts: user?.receiveAlerts ?? true });

  const load = () => {
    api<Pet[]>("/pets").then(setPets).catch(() => {});
    api<Alert[]>("/alerts/mine").then(setAlerts).catch(() => {});
  };
  useEffect(() => { if (open) { load(); if (user) setPref({ city: user.city, uf: user.uf, receiveAlerts: user.receiveAlerts }); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePref = async () => {
    try { update(await api<User>("/me", { method: "PATCH", body: pref })); toast("Preferências salvas."); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Não foi possível salvar.", "error"); }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Olá, ${user?.name.split(" ")[0] ?? ""}`} side>
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold">Meus pets e plaquinhas</h3>
            <button type="button" className="text-sm font-bold text-brand-600 flex items-center gap-1 cursor-pointer" onClick={() => setAdding((v) => !v)}><Plus className="w-4 h-4" />Cadastrar</button>
          </div>
          <p className="text-sm text-stone-600 mb-3">Cadastre o pet e coloque a plaquinha com QR Code na coleira <b>antes</b> de ele se perder: quem o encontrar avisa você na hora.</p>
          {adding && <PetForm onDone={(p) => { setAdding(false); setPets((s) => [...s, p]); }} />}
          {pets.length === 0 && !adding && <p className="text-sm text-stone-500">Nenhum pet cadastrado.</p>}
          <ul className="space-y-2">
            {pets.map((p) => (
              <li key={p.id} className="card p-3 flex items-center gap-3">
                {p.photo ? <img src={media(p.photo)} alt="" className="w-12 h-12 rounded-xl object-cover" /> : <div className="w-12 h-12 rounded-xl bg-stone-200" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-stone-500">{SPECIES[p.species]} · {p.breed}</p>
                </div>
                <button type="button" className="btn-ghost h-9 px-3 text-sm" onClick={() => setTagFor(p)}><QrCode className="w-4 h-4" />Plaquinha</button>
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
          <CityFields city={pref.city} uf={pref.uf} onChange={(city, uf) => setPref({ ...pref, city, uf })} />
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1 w-4 h-4 accent-[#0F7F8C]" checked={pref.receiveAlerts} onChange={(e) => setPref({ ...pref, receiveAlerts: e.target.checked })} />
            <span>Receber alertas de pets perdidos e avistados na minha cidade.</span>
          </label>
          <button type="button" className="btn-primary w-full" onClick={savePref}>Salvar preferências</button>
        </section>

        <button type="button" className="btn-ghost w-full" onClick={() => { logout(); onClose(); }}>Sair da conta</button>
      </Modal>
      <TagModal pet={tagFor} onClose={() => setTagFor(null)} />
    </>
  );
}

function PetForm({ onDone }: { onDone: (p: Pet) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", species: "cao" as Species, breed: "", color: "" });
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { onDone(await api<Pet>("/pets", { body: { ...f, color: f.color || null, photoId: photo?.id ?? null } })); toast("Pet cadastrado. Imprima a plaquinha!"); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Não foi possível cadastrar.", "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="card p-3 mb-3 space-y-2">
      <input className="input" placeholder="Nome do pet *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <select className="input" value={f.species} onChange={(e) => setF({ ...f, species: e.target.value as Species })}>
          {Object.entries(SPECIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input" placeholder="Raça ou SRD *" value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} />
      </div>
      <input className="input" placeholder="Cor e sinais" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
      <label className="btn-ghost w-full">
        {photo ? "Foto adicionada ✓" : "Adicionar foto"}
        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          try { setPhoto(await uploadImage(file)); } catch (er) { toast(er instanceof ApiError ? er.message : "Falha ao enviar a foto.", "error"); }
        }} />
      </label>
      <button type="button" className="btn-primary w-full" disabled={busy} onClick={save}>Salvar pet</button>
    </div>
  );
}

function TagModal({ pet, onClose }: { pet: Pet | null; onClose: () => void }) {
  if (!pet) return null;
  const url = siteUrl(`/p/${pet.tagCode}`);
  return (
    <Modal open onClose={onClose} title={`Plaquinha de ${pet.name}`}>
      <div className="flex flex-col items-center text-center">
        <div className="rounded-full border-[6px] border-brand-500 p-6 flex flex-col items-center bg-white">
          <QrImage value={url} size={170} />
          <p className="font-extrabold mt-2">{pet.name}</p>
          <p className="text-xs text-stone-500">Me achou? Leia o QR</p>
        </div>
        <p className="text-sm text-stone-600 mt-4">Quem ler o QR vê a página do pet e pode avisar você com a localização, sem precisar de conta.</p>
        <p className="text-xs text-stone-400 mt-1 break-all">{url}</p>
        <div className="flex gap-2 mt-4 w-full">
          <a className="btn-ghost flex-1" href={`/p/${pet.tagCode}`} target="_blank" rel="noreferrer">Abrir página</a>
          <button type="button" className="btn-primary flex-1" onClick={() => printTag(pet.name, url)}><Printer className="w-4 h-4" />Imprimir</button>
        </div>
      </div>
    </Modal>
  );
}
