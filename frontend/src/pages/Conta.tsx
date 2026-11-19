import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Download, ExternalLink, PawPrint, Pencil, Plus, QrCode, Settings2, ShieldCheck, Siren, Trash2 } from "lucide-react";
import { CityFields } from "../components/CityFields";
import { ConfirmModal } from "../components/ConfirmModal";
import { PetForm } from "../components/PetEditor";
import { TagModal } from "../components/TagModal";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { api, ApiError, media } from "../lib/api";
import { SPECIES, alertTitle, ago } from "../lib/format";
import type { Alert, Pet, User } from "../lib/types";
import * as v from "../lib/validate";

type Tab = "pets" | "alertas" | "dados" | "privacidade";
const TABS: { k: Tab; label: string; Icon: typeof PawPrint }[] = [
  { k: "pets", label: "Meus pets", Icon: PawPrint },
  { k: "alertas", label: "Meus alertas", Icon: Siren },
  { k: "dados", label: "Meus dados", Icon: Settings2 },
  { k: "privacidade", label: "Privacidade", Icon: ShieldCheck },
];
const STATUS: Record<Alert["status"], string> = { aberto: "Ativo", resolvido: "Resolvido", arquivado: "Arquivado" };

/** Pagina privada Minha conta: pets e plaquinhas, alertas, dados e privacidade (LGPD). */
export default function Conta() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const raw = sp.get("aba");
  const tab: Tab = TABS.some((t) => t.k === raw) ? (raw as Tab) : "pets";
  if (!user) return null;
  return (
    <div className="pb-10">
      <div className="flex items-center gap-4 mb-5">
        <span className="w-14 h-14 rounded-full bg-brand-50 text-brand-700 text-2xl font-extrabold flex items-center justify-center shrink-0">{user.name.trim()[0]?.toUpperCase()}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold truncate">{user.name}</h1>
          <p className="text-sm text-stone-600 truncate">{user.email} · {user.city}, {user.uf}</p>
        </div>
      </div>
      <div className="grid md:grid-cols-[220px_1fr] gap-4 items-start">
        <nav aria-label="Seções da conta" className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          {TABS.map(({ k, label, Icon }) => (
            <button key={k} type="button" aria-current={tab === k ? "page" : undefined} onClick={() => setSp({ aba: k }, { replace: true })}
              className={`h-11 px-4 rounded-xl text-sm font-bold flex items-center gap-2 shrink-0 cursor-pointer border ${tab === k ? "bg-brand-600 text-white border-brand-600" : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </nav>
        <section className="min-w-0">
          {tab === "pets" && <PetsTab />}
          {tab === "alertas" && <AlertsTab />}
          {tab === "dados" && <DataTab />}
          {tab === "privacidade" && <PrivacyTab />}
        </section>
      </div>
    </div>
  );
}

function PetsTab() {
  const toast = useToast();
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [form, setForm] = useState<Pet | "new" | null>(null);
  const [tagFor, setTagFor] = useState<Pet | null>(null);
  const [delPet, setDelPet] = useState<Pet | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<Pet[]>("/pets").then(setPets).catch(() => setPets([]));
  useEffect(() => { load(); }, []);

  const remove = async () => {
    if (!delPet) return;
    setBusy(true);
    try { await api(`/pets/${delPet.id}`, { method: "DELETE" }); toast(`${delPet.name} foi excluído.`); setDelPet(null); await load(); }
    catch (er) { toast(er instanceof ApiError ? er.message : "Não foi possível excluir.", "error"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="text-xl font-extrabold">Meus pets e plaquinhas</h2>
        <button type="button" className="btn-primary h-10 px-4 text-sm" onClick={() => setForm("new")}><Plus className="w-4 h-4" />Cadastrar pet</button>
      </div>
      <p className="text-sm text-stone-600 mb-4">Cadastre o pet e coloque a plaquinha com QR Code na coleira <b>antes</b> de ele se perder: quem o encontrar avisa você na hora.</p>

      {pets === null && <div className="card h-40 animate-pulse bg-stone-100" />}
      {pets?.length === 0 && (
        <div className="card p-8 text-center text-stone-600">
          <PawPrint className="w-9 h-9 mx-auto text-stone-300" />
          <p className="font-semibold mt-2">Nenhum pet cadastrado ainda.</p>
          <button type="button" className="btn-primary mt-3" onClick={() => setForm("new")}><Plus className="w-4 h-4" />Cadastrar meu primeiro pet</button>
        </div>
      )}
      <ul className="grid sm:grid-cols-2 gap-3">
        {pets?.map((p) => (
          <li key={p.id} className="card overflow-hidden flex flex-col">
            <Link to={`/p/${p.tagCode}`} aria-label={`Abrir a página de ${p.name}`}>
              {p.photo ? <img src={media(p.photo)} alt="" className="w-full h-44 object-cover" /> : <div className="w-full h-44 bg-stone-200 flex items-center justify-center text-stone-400"><PawPrint className="w-10 h-10" /></div>}
            </Link>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/p/${p.tagCode}`} className="font-extrabold text-lg truncate block hover:underline">{p.name}</Link>
                  <p className="text-sm text-stone-600">{SPECIES[p.species]} · {p.breed}</p>
                </div>
                {p.openAlertId && <span className="chip bg-red-100 text-red-700 shrink-0">Alerta ativo</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Link to={`/p/${p.tagCode}`} className="btn-ghost h-10 text-sm"><ExternalLink className="w-4 h-4" />Página do pet</Link>
                <button type="button" className="btn-ghost h-10 text-sm" onClick={() => setTagFor(p)}><QrCode className="w-4 h-4" />Plaquinha</button>
                <button type="button" className="btn-ghost h-10 text-sm" onClick={() => setForm(p)}><Pencil className="w-4 h-4" />Editar</button>
                <button type="button" className="btn-ghost h-10 text-sm text-red-700" onClick={() => setDelPet(p)}><Trash2 className="w-4 h-4" />Excluir</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={!!form} onClose={() => setForm(null)} title={form === "new" ? "Cadastrar pet" : `Editar ${form?.name ?? ""}`}>
        {form && <PetForm pet={form === "new" ? undefined : form} onCancel={() => setForm(null)}
          onDone={(p) => { const novo = form === "new"; setForm(null); load(); if (novo) setTagFor(p); }} />}
      </Modal>
      <TagModal pet={tagFor} onClose={() => setTagFor(null)} />
      <ConfirmModal open={!!delPet} title={`Excluir ${delPet?.name ?? "pet"}?`} confirmLabel="Excluir pet" busy={busy} onClose={() => setDelPet(null)} onConfirm={remove}>
        <p>O cadastro e a foto de <b>{delPet?.name}</b> serão apagados e a plaquinha impressa <b>deixa de funcionar</b>. As leituras da plaquinha também são apagadas.</p>
        {delPet?.openAlertId && <p className="text-red-700 font-semibold">Este pet tem um alerta ativo. O alerta continua publicado, sem o vínculo com o cadastro.</p>}
        <p>Essa ação não pode ser desfeita.</p>
      </ConfirmModal>
    </div>
  );
}

function AlertsTab() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  useEffect(() => { api<Alert[]>("/alerts/mine").then(setAlerts).catch(() => setAlerts([])); }, []);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-extrabold">Meus alertas</h2>
        <Link to="/publicar" className="btn-accent h-10 px-4 text-sm"><Plus className="w-4 h-4" />Publicar alerta</Link>
      </div>
      {alerts === null && <div className="card h-24 animate-pulse bg-stone-100" />}
      {alerts?.length === 0 && <div className="card p-8 text-center text-stone-600">Você ainda não publicou alertas.</div>}
      <ul className="space-y-2">
        {alerts?.map((a) => (
          <li key={a.id}>
            <Link to={`/caso/${a.id}`} className="card p-3 flex items-center gap-3 hover:bg-stone-50">
              <img src={media(a.images[0])} alt="" className="w-16 h-16 rounded-xl object-cover bg-stone-200" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{alertTitle(a)}</p>
                <p className="text-xs text-stone-500">{a.type === "perdido" ? "Perdido" : "Avistado"} · {a.city}, {a.uf} · {ago(a.createdAt)}</p>
              </div>
              <span className={`chip ${a.status === "aberto" ? "bg-green-100 text-green-800" : a.status === "arquivado" ? "bg-amber-100 text-amber-800" : "bg-stone-200 text-stone-700"}`}>{STATUS[a.status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTab() {
  const { user, update } = useAuth();
  const toast = useToast();
  const [data, setData] = useState({ name: user!.name, currentPassword: "", newPassword: "" });
  const [dataErr, setDataErr] = useState<Record<string, string>>({});
  const [pref, setPref] = useState({ city: user!.city, uf: user!.uf, receiveAlerts: user!.receiveAlerts });
  const [prefErr, setPrefErr] = useState<Record<string, string>>({});

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

  const savePref = async () => {
    const e = v.clean({ uf: pref.uf ? undefined : "Escolha o estado.", city: pref.city ? undefined : "Escolha a cidade na lista." });
    setPrefErr(e);
    if (Object.keys(e).length) return;
    try { update(await api<User>("/me", { method: "PATCH", body: pref })); toast("Preferências salvas."); }
    catch (er) { toast(er instanceof ApiError ? er.message : "Não foi possível salvar.", "error"); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5 space-y-3">
        <h2 className="text-lg font-extrabold">Meus dados</h2>
        <div>
          <label className="label" htmlFor="md-name">Nome</label>
          <input id="md-name" className={`input ${dataErr.name ? "!border-red-500" : ""}`} maxLength={80} value={data.name} autoComplete="name" onChange={(e) => { setData({ ...data, name: e.target.value }); setDataErr({}); }} />
          {dataErr.name && <p className="field-error">{dataErr.name}</p>}
        </div>
        <div>
          <p className="label">E-mail</p>
          <p className="text-sm text-stone-600">{user!.email}</p>
        </div>
        <details className="rounded-xl border border-stone-200 p-3" open={!!(dataErr.currentPassword || dataErr.newPassword)}>
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
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-lg font-extrabold">Minha cidade e alertas</h2>
        <CityFields idPrefix="pref" city={pref.city} uf={pref.uf} onChange={(city, uf) => { setPref({ ...pref, city, uf }); setPrefErr({}); }} errors={prefErr} />
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1 w-4 h-4 accent-[#0F7F8C]" checked={pref.receiveAlerts} onChange={(e) => setPref({ ...pref, receiveAlerts: e.target.checked })} />
          <span>Receber alertas de pets perdidos e avistados na minha cidade.</span>
        </label>
        <button type="button" className="btn-primary w-full" onClick={savePref}>Salvar preferências</button>
      </div>
    </div>
  );
}

function PrivacyTab() {
  const { logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const exportData = async () => {
    try {
      const d = await api("/me/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "meus-dados-tailypaw.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (er) { toast(er instanceof ApiError ? er.message : "Não foi possível baixar.", "error"); }
  };

  const removeAccount = async (password: string) => {
    setBusy(true); setErr("");
    try {
      await api("/me", { method: "DELETE", body: { password } });
      setDel(false); logout(); nav("/");
      toast("Sua conta e seus dados foram apagados.");
    } catch (er) { setErr(er instanceof ApiError ? er.message : "Não foi possível apagar a conta."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card p-5">
        <h2 className="text-lg font-extrabold">Seus dados (LGPD)</h2>
        <p className="text-sm text-stone-600 mt-1">Você tem direito de acessar, corrigir e apagar seus dados. Eles são usados só para avisar pets perdidos na sua cidade e para a conversa com quem ajuda.</p>
        <button type="button" className="btn-ghost mt-4" onClick={exportData}><Download className="w-4 h-4" />Baixar meus dados</button>
      </div>
      <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
        <h2 className="text-lg font-extrabold text-red-800">Apagar minha conta</h2>
        <p className="text-sm text-stone-700 mt-1">Apaga para sempre seu cadastro, <b>seus pets e plaquinhas</b>, alertas, fotos, conversas, mensagens e quem você segue. Plaquinhas já impressas deixam de funcionar.</p>
        <button type="button" className="btn-danger mt-4" onClick={() => { setErr(""); setDel(true); }}><Trash2 className="w-4 h-4" />Apagar minha conta</button>
      </div>
      <ConfirmModal open={del} title="Apagar minha conta?" confirmLabel="Apagar tudo" askPassword busy={busy} error={err} onClose={() => setDel(false)} onConfirm={removeAccount}>
        <p>Serão apagados para sempre: seu cadastro, <b>seus pets e plaquinhas</b>, alertas, fotos, conversas, mensagens e quem você segue.</p>
        <p>Plaquinhas já impressas deixam de funcionar. Essa ação não pode ser desfeita.</p>
      </ConfirmModal>
    </div>
  );
}
