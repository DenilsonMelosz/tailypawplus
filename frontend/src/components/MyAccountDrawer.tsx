import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, ExternalLink, Pencil, Plus, Printer, QrCode, Scissors, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { CityFields } from "./CityFields";
import { PetForm } from "./PetEditor";
import { ConfirmModal } from "./ConfirmModal";
import { siteUrl } from "./QrImage";
import { useAuth } from "../lib/auth";
import { api, ApiError, media } from "../lib/api";
import { SPECIES, alertTitle, ago } from "../lib/format";
import type { Alert, Pet, User } from "../lib/types";
import { useToast } from "./Toast";
import { printTag } from "../lib/print";
import { svgToDataUrl, tagSvg } from "../lib/tagArt";
import * as v from "../lib/validate";

const STATUS: Record<Alert["status"], string> = { aberto: "Ativo", resolvido: "Resolvido", arquivado: "Arquivado" };

/** Painel lateral (nao e uma tela): meus pets e plaquinhas, meus alertas e preferencias. */
export function MyAccountDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, update, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [editing, setEditing] = useState<string | null>(null);
  const [delPet, setDelPet] = useState<Pet | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delAcc, setDelAcc] = useState(false);
  const [accErr, setAccErr] = useState("");
  const [pets, setPets] = useState<Pet[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [adding, setAdding] = useState(false);
  const [tagFor, setTagFor] = useState<Pet | null>(null);
  const [pref, setPref] = useState({ city: user?.city ?? "", uf: user?.uf ?? "", receiveAlerts: user?.receiveAlerts ?? true });
  const [prefErr, setPrefErr] = useState<Record<string, string>>({});
  const [data, setData] = useState({ name: user?.name ?? "", currentPassword: "", newPassword: "" });
  const [dataErr, setDataErr] = useState<Record<string, string>>({});

  const load = () => {
    api<Pet[]>("/pets").then(setPets).catch(() => {});
    api<Alert[]>("/alerts/mine").then(setAlerts).catch(() => {});
  };
  useEffect(() => {
    if (!open) return;
    load();
    if (user) { setPref({ city: user.city, uf: user.uf, receiveAlerts: user.receiveAlerts }); setData({ name: user.name, currentPassword: "", newPassword: "" }); }
    setPrefErr({}); setDataErr({}); setEditing(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePref = async () => {
    const e = v.clean({ uf: pref.uf ? undefined : "Escolha o estado.", city: pref.city ? undefined : "Escolha a cidade na lista." });
    setPrefErr(e);
    if (Object.keys(e).length) return;
    try { update(await api<User>("/me", { method: "PATCH", body: pref })); toast("Preferências salvas."); }
    catch (er) { toast(er instanceof ApiError ? er.message : "Não foi possível salvar.", "error"); }
  };

  const saveData = async () => {
    const e = v.clean({
      name: v.name(data.name),
      currentPassword: data.newPassword && !data.currentPassword ? "Informe a senha atual." : undefined,
      newPassword: data.newPassword ? v.password(data.newPassword) : undefined,
    });
    setDataErr(e);
    if (Object.keys(e).length) return;
    try {
      const body: Record<string, unknown> = { name: data.name.trim() };
      if (data.newPassword) { body.currentPassword = data.currentPassword; body.newPassword = data.newPassword; }
      update(await api<User>("/me", { method: "PATCH", body }));
      setData((d) => ({ ...d, currentPassword: "", newPassword: "" }));
      toast(data.newPassword ? "Dados e senha salvos." : "Dados salvos.");
    } catch (er) {
      if (er instanceof ApiError && er.data?.field === "currentPassword") setDataErr({ currentPassword: er.message });
      else toast(er instanceof ApiError ? er.message : "Não foi possível salvar.", "error");
    }
  };

  const removePet = async () => {
    if (!delPet) return;
    setDelBusy(true);
    try { await api(`/pets/${delPet.id}`, { method: "DELETE" }); setPets((s) => s.filter((x) => x.id !== delPet.id)); toast(`${delPet.name} foi excluído.`); setDelPet(null); load(); }
    catch (er) { toast(er instanceof ApiError ? er.message : "Não foi possível excluir.", "error"); }
    finally { setDelBusy(false); }
  };

  const exportData = async () => {
    try {
      const d = await api("/me/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "meus-dados-tailypaw.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (er) { toast(er instanceof ApiError ? er.message : "Não foi possível baixar.", "error"); }
  };

  const removeAccount = async (password: string) => {
    setDelBusy(true); setAccErr("");
    try {
      await api("/me", { method: "DELETE", body: { password } });
      setDelAcc(false); onClose(); logout(); nav("/");
      toast("Sua conta e seus dados foram apagados.");
    } catch (er) { setAccErr(er instanceof ApiError ? er.message : "Não foi possível apagar a conta."); }
    finally { setDelBusy(false); }
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
            {pets.map((p) => editing === p.id ? (
              <li key={p.id}><PetForm pet={p} onCancel={() => setEditing(null)} onDone={(np) => { setPets((s) => s.map((x) => (x.id === np.id ? np : x))); setEditing(null); }} /></li>
            ) : (
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
                  <button type="button" className="btn-ghost h-9 px-3 text-sm" onClick={() => setEditing(p.id)}><Pencil className="w-4 h-4" />Editar</button>
                  <button type="button" className="btn-ghost h-9 px-3 text-sm text-red-700" onClick={() => setDelPet(p)}><Trash2 className="w-4 h-4" />Excluir</button>
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
          <h3 className="font-bold">Meus dados</h3>
          <div>
            <label className="label" htmlFor="md-name">Nome</label>
            <input id="md-name" className={`input ${dataErr.name ? "!border-red-500" : ""}`} maxLength={80} value={data.name} onChange={(e) => { setData({ ...data, name: e.target.value }); setDataErr({}); }} autoComplete="name" />
            {dataErr.name && <p className="field-error">{dataErr.name}</p>}
          </div>
          <div>
            <p className="label">E-mail</p>
            <p className="text-sm text-stone-600">{user?.email}</p>
          </div>
          <details className="rounded-xl border border-stone-200 p-3">
            <summary className="font-semibold text-sm cursor-pointer">Trocar a senha</summary>
            <div className="space-y-2 mt-3">
              <div>
                <label className="label" htmlFor="md-cur">Senha atual</label>
                <input id="md-cur" type="password" className={`input ${dataErr.currentPassword ? "!border-red-500" : ""}`} maxLength={100} value={data.currentPassword} autoComplete="current-password" onChange={(e) => { setData({ ...data, currentPassword: e.target.value }); setDataErr({}); }} />
                {dataErr.currentPassword && <p className="field-error">{dataErr.currentPassword}</p>}
              </div>
              <div>
                <label className="label" htmlFor="md-new">Nova senha</label>
                <input id="md-new" type="password" className={`input ${dataErr.newPassword ? "!border-red-500" : ""}`} maxLength={100} value={data.newPassword} autoComplete="new-password" onChange={(e) => { setData({ ...data, newPassword: e.target.value }); setDataErr({}); }} />
                {dataErr.newPassword ? <p className="field-error">{dataErr.newPassword}</p> : <p className="text-xs text-stone-500 mt-1">Pelo menos 6 caracteres.</p>}
              </div>
            </div>
          </details>
          <button type="button" className="btn-primary w-full" onClick={saveData}>Salvar meus dados</button>
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

        <section className="mb-6 rounded-2xl border border-red-200 bg-red-50/50 p-4 space-y-3">
          <h3 className="font-bold">Privacidade e seus dados (LGPD)</h3>
          <p className="text-sm text-stone-700">Você pode baixar uma cópia dos seus dados ou apagar a conta. Ao apagar, seus pets, plaquinhas, alertas, fotos, conversas e seguidores são excluídos para sempre.</p>
          <button type="button" className="btn-ghost w-full" onClick={exportData}><Download className="w-4 h-4" />Baixar meus dados</button>
          <button type="button" className="btn-danger w-full" onClick={() => { setAccErr(""); setDelAcc(true); }}><Trash2 className="w-4 h-4" />Apagar minha conta</button>
        </section>

        <button type="button" className="btn-ghost w-full" onClick={() => { logout(); onClose(); nav("/"); }}>Sair da conta</button>
      </Modal>
      <ConfirmModal open={!!delPet} title={`Excluir ${delPet?.name ?? "pet"}?`} confirmLabel="Excluir pet" busy={delBusy} onClose={() => setDelPet(null)} onConfirm={removePet}>
        <p>O cadastro e a foto de <b>{delPet?.name}</b> serão apagados e a plaquinha impressa <b>deixa de funcionar</b>. As leituras da plaquinha também são apagadas.</p>
        {delPet?.openAlertId && <p className="text-red-700 font-semibold">Este pet tem um alerta ativo. O alerta continua publicado, sem o vínculo com o cadastro.</p>}
        <p>Essa ação não pode ser desfeita.</p>
      </ConfirmModal>
      <ConfirmModal open={delAcc} title="Apagar minha conta?" confirmLabel="Apagar tudo" askPassword busy={delBusy} error={accErr} onClose={() => setDelAcc(false)} onConfirm={removeAccount}>
        <p>Serão apagados para sempre: seu cadastro, <b>seus pets e plaquinhas</b>, alertas, fotos, conversas, mensagens e quem você segue.</p>
        <p>Plaquinhas já impressas deixam de funcionar. Essa ação não pode ser desfeita.</p>
      </ConfirmModal>
      <TagModal pet={tagFor} onClose={() => setTagFor(null)} onNavigate={onClose} />
    </>
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
