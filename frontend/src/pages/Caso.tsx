import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, CheckCircle2, Download, Heart, MapPin, MessageCircle, Pencil, Printer, Scissors, Share2, Siren, Trash2 } from "lucide-react";
import { PetForm } from "../components/PetEditor";
import { ConfirmModal } from "../components/ConfirmModal";
import { api, ApiError, media } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SEXES, SIZES, SPECIES, alertTitle, ago, currentPosition, dateTime } from "../lib/format";
import { printPoster, printTag } from "../lib/print";
import { svgToDataUrl, tagSvg } from "../lib/tagArt";
import * as v from "../lib/validate";
import type { Alert, Pet } from "../lib/types";
import { TypeChip } from "../components/AlertCard";
import { COLORS, MapView } from "../components/MapView";
import { Modal } from "../components/Modal";
import { siteUrl } from "../components/QrImage";
import { useToast } from "../components/Toast";

function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  if (!images.length) return <div className="aspect-[4/3] bg-stone-200 rounded-2xl" />;
  return (
    <div>
      <img src={media(images[i])} alt={alt} className="w-full aspect-[4/3] object-cover rounded-2xl bg-stone-200" />
      {images.length > 1 && (
        <div className="flex gap-2 mt-2">
          {images.map((src, k) => (
            <button key={src} type="button" onClick={() => setI(k)} className={`w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer ${k === i ? "border-brand-600" : "border-transparent"}`}>
              <img src={media(src)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

async function share(title: string, url: string, toast: (m: string, k?: "ok" | "error") => void) {
  try {
    if (navigator.share) await navigator.share({ title, url });
    else { await navigator.clipboard.writeText(url); toast("Link copiado."); }
  } catch { /* cancelado */ }
}

/** T3 Caso do pet (RF05, RF06, RF10, RF11). */
export function CasoPage() {
  const { id } = useParams();
  const { user, requireLogin } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [a, setA] = useState<Alert | null>(null);
  const [err, setErr] = useState("");
  const [poster, setPoster] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api<Alert>(`/alerts/${id}`).then(setA).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro ao carregar."));
  useEffect(() => { load(); }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <p className="text-center py-16 text-stone-600">{err}</p>;
  if (!a) return <div className="card h-96 animate-pulse bg-stone-100" />;

  const title = alertTitle(a);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); await load(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Não foi possível concluir.", "error"); }
    finally { setBusy(false); }
  };

  const message = async () => {
    if (!(await requireLogin("Entre para conversar com quem publicou. Seu telefone não aparece."))) return;
    try { const c = await api<{ id: string }>("/conversations", { body: { alertId: a.id } }); nav(`/conversas/${c.id}`); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Erro ao abrir a conversa.", "error"); }
  };
  const claim = async () => {
    if (!(await requireLogin("Entre para avisar que o pet é seu."))) return;
    try { const r = await api<{ conversationId: string }>(`/alerts/${a.id}/claim`, { method: "POST" }); toast("Avisamos quem publicou."); nav(`/conversas/${r.conversationId}`); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Erro.", "error"); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6 pb-10">
      <div>
        <Gallery images={a.images} alt={title} />
        <div className="mt-4">
          <MapView height={230} title={`Local de ${title}`} points={[{ id: a.id, lat: a.lat, lng: a.lng, approximate: a.approximate, color: COLORS[a.type], label: a.approximate ? "Região aproximada" : "Ponto exato (só você vê)" }]} />
          <p className="text-xs text-stone-500 mt-1">{a.approximate ? "Área aproximada de onde o pet foi visto (até ~200 m)." : "Você vê o ponto exato; os outros veem uma área aproximada."}</p>
        </div>
      </div>

      <div>
        <TypeChip a={a} />
        <h1 className="text-3xl font-extrabold mt-1">{title}</h1>
        <p className="text-stone-600">{[SPECIES[a.species], a.breed, a.size ? SIZES[a.size] : null, a.sex ? SEXES[a.sex] : null, a.color].filter(Boolean).join(" · ")}</p>
        <p className="text-sm text-stone-600 mt-2 flex items-center gap-1"><MapPin className="w-4 h-4" />{a.city}, {a.uf} · publicado {ago(a.createdAt)} por {a.isMine ? "você" : a.author.name.split(" ")[0]}</p>
        {a.lastSeenAt && <p className="text-sm text-stone-600 flex items-center gap-1"><CalendarClock className="w-4 h-4" />Visto por último em {dateTime(a.lastSeenAt)}</p>}
        <p className="mt-3 whitespace-pre-line">{a.description}</p>
        {a.reward && <div className="mt-3 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 font-bold text-orange-800">Recompensa: {a.reward}</div>}

        {a.isMine ? (
          <OwnerActions a={a} busy={busy} run={run} onPoster={() => setPoster(true)} onDeleted={() => nav("/resgate")} />
        ) : a.status === "aberto" ? (
          <div className="space-y-2 mt-5">
            {a.type === "avistado" && <button type="button" className="btn-danger w-full" onClick={claim}><Heart className="w-5 h-5" />Sou o dono</button>}
            <button type="button" className="btn-primary w-full" onClick={message}><MessageCircle className="w-5 h-5" />{a.type === "perdido" ? "Vi este pet: enviar mensagem" : "Enviar mensagem"}</button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => setPoster(true)}><Download className="w-4 h-4" />Baixar cartaz</button>
              <button type="button" className="btn-ghost" onClick={() => share(title, siteUrl(`/caso/${a.id}`), toast)}><Share2 className="w-4 h-4" />Compartilhar</button>
            </div>
            <p className="text-xs text-stone-500">O contato acontece pelo TailyPaw+: telefone e endereço não aparecem.</p>
          </div>
        ) : (
          <p className="mt-5 card p-4 text-stone-600">{a.status === "resolvido" ? "Este caso foi resolvido. Obrigado por ajudar!" : "Este alerta foi arquivado por falta de confirmação."}</p>
        )}
      </div>

      <PosterModal open={poster} onClose={() => setPoster(false)} a={a} />
    </div>
  );
}

function OwnerActions({ a, busy, run, onPoster, onDeleted }: {
  a: Alert; busy: boolean; run: (fn: () => Promise<unknown>, ok: string) => Promise<void>; onPoster: () => void; onDeleted: () => void;
}) {
  const toast = useToast();
  const [confirmDel, setConfirmDel] = useState(false);
  const [scans, setScans] = useState<{ id: string; lat: number; lng: number; message: string | null; createdAt: string }[]>([]);
  useEffect(() => { if (a.petId) api(`/pets/${a.petId}/scans`).then(setScans).catch(() => {}); }, [a.petId]);

  return (
    <div className="mt-5 space-y-3">
      {a.status === "aberto" && a.confirmationRequestedAt && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="font-bold">{a.animalName ?? "Seu pet"} continua desaparecido?</p>
          <p className="text-sm text-stone-700">Sem confirmação, o alerta é arquivado e sai do mapa.</p>
          <div className="flex gap-2 mt-3">
            <button type="button" className="btn-primary flex-1" disabled={busy} onClick={() => run(() => api(`/alerts/${a.id}/confirm`, { method: "POST" }), "Obrigado! Seguimos procurando.")}>Sim, continua</button>
            <button type="button" className="btn-ghost flex-1" disabled={busy} onClick={() => run(() => api(`/alerts/${a.id}/resolve`, { method: "POST" }), "Que ótimo! Caso resolvido.")}>Já encontrei</button>
          </div>
        </div>
      )}
      <p className="text-sm font-semibold text-stone-500">Somente você vê:</p>
      {a.status === "aberto" && (
        <button type="button" className="btn w-full bg-green-600 text-white hover:bg-green-700" disabled={busy}
          onClick={() => run(() => api(`/alerts/${a.id}/resolve`, { method: "POST" }), "Caso resolvido. Ele saiu do mapa.")}>
          <CheckCircle2 className="w-5 h-5" />Marcar como Devolvido / Resolvido
        </button>
      )}
      {a.status === "arquivado" && (
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => run(() => api(`/alerts/${a.id}/reactivate`, { method: "POST" }), "Alerta reativado.")}><Siren className="w-5 h-5" />Reativar alerta</button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost" onClick={onPoster}><Download className="w-4 h-4" />Baixar cartaz</button>
        <button type="button" className="btn-ghost" onClick={() => share(alertTitle(a), siteUrl(`/caso/${a.id}`), toast)}><Share2 className="w-4 h-4" />Compartilhar</button>
      </div>
      {a.petId && (
        <div className="card p-4">
          <p className="font-bold">Leituras da plaquinha ({scans.length})</p>
          {scans.length === 0 ? <p className="text-sm text-stone-500">Ninguém leu a plaquinha ainda.</p> : (
            <>
              <div className="mt-2"><MapView height={180} title="Leituras da plaquinha" points={scans.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, color: COLORS.scan, label: dateTime(s.createdAt) }))} /></div>
              <ul className="text-sm mt-2 space-y-1">{scans.map((s) => <li key={s.id}>📍 {dateTime(s.createdAt)}{s.message ? ` · "${s.message}"` : ""}</li>)}</ul>
            </>
          )}
        </div>
      )}
      <button type="button" className="text-sm text-red-600 font-semibold flex items-center gap-1 cursor-pointer" disabled={busy}
        onClick={() => setConfirmDel(true)}>
        <Trash2 className="w-4 h-4" />Excluir alerta
      </button>
      <ConfirmModal open={confirmDel} title="Excluir este alerta?" confirmLabel="Excluir alerta" busy={busy} onClose={() => setConfirmDel(false)}
        onConfirm={async () => {
          try { await api(`/alerts/${a.id}`, { method: "DELETE" }); toast("Alerta excluído."); setConfirmDel(false); onDeleted(); }
          catch (e) { toast(e instanceof ApiError ? e.message : "Não foi possível excluir.", "error"); setConfirmDel(false); }
        }}>
        <p>O alerta de <b>{alertTitle(a)}</b> sai do mapa e da lista, e as conversas ligadas a ele deixam de mostrar o caso.</p>
        <p>Se o pet foi encontrado, prefira <b>Marcar como resolvido</b>. Excluir não pode ser desfeito.</p>
      </ConfirmModal>
    </div>
  );
}

/** RF06: cartaz com QR Code; o telefone e opcional e nao fica salvo. */
function PosterModal({ open, onClose, a }: { open: boolean; onClose: () => void; a: Alert }) {
  const [phone, setPhone] = useState("");
  const [extra, setExtra] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const url = a.tagCode ? siteUrl(`/p/${a.tagCode}`) : siteUrl(`/caso/${a.id}`);
  return (
    <Modal open={open} onClose={onClose} title="Baixar cartaz">
      <p className="text-sm text-stone-600 mb-3">O cartaz traz a foto, os dados e um QR Code que leva {a.tagCode ? "à página do pet" : "a este caso"}. Use "Salvar como PDF" na janela de impressão para baixar.</p>
      <label className="label" htmlFor="ex">Informação extra (opcional)</label>
      <input id="ex" className="input" value={extra} maxLength={120} onChange={(e) => { setExtra(e.target.value); setErrs((x) => ({ ...x, extra: "" })); }} placeholder="Ex.: muito assustado, não corra atrás" />
      <p className="text-xs text-stone-400 text-right mb-2">{extra.length}/120</p>
      {a.isMine && (
        <>
          <label className="label" htmlFor="ph">Mostrar telefone no cartaz? (opcional)</label>
          <input id="ph" className={`input ${errs.phone ? "!border-red-500" : ""}`} value={phone} maxLength={20} onChange={(e) => { setPhone(e.target.value); setErrs((x) => ({ ...x, phone: "" })); }} placeholder="Ex.: (71) 99999-0000. Vazio = só o QR Code" inputMode="tel" autoComplete="tel" />
          {errs.phone && <p className="field-error">{errs.phone}</p>}
          <p className="text-xs text-stone-500 mt-1 mb-3">O telefone não fica salvo nem aparece no aplicativo.</p>
        </>
      )}
      <button type="button" className="btn-primary w-full" onClick={() => {
        const bad = v.phone(phone);
        if (bad) { setErrs({ phone: bad }); return; }
        printPoster({
          title: alertTitle(a), photo: media(a.images[0]), type: a.type,
          details: [SPECIES[a.species], a.breed, a.size ? SIZES[a.size] : null, a.color].filter(Boolean).join(" · "),
          where: `Visto em ${a.city}, ${a.uf}${a.lastSeenAt ? ` em ${dateTime(a.lastSeenAt)}` : ""}`, reward: a.reward, phone: phone.trim(), url, extra: extra.trim(),
        });
        onClose();
      }}><Download className="w-4 h-4" />Gerar cartaz</button>
    </Modal>
  );
}

/** Pagina da plaquinha (T3 aberta pelo QR da coleira): sem login (RNF03), RN10. */
export function TagPage() {
  const { code } = useParams();
  const toast = useToast();
  const [pet, setPet] = useState<(Pet & { lostAlertId: string | null; isOwner: boolean; petId: string }) | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scans, setScans] = useState<{ id: string; lat: number; lng: number; message: string | null; createdAt: string }[]>([]);
  const [tagImg, setTagImg] = useState("");
  const [editPet, setEditPet] = useState(false);
  const [delPet, setDelPet] = useState(false);
  const nav = useNavigate();

  useEffect(() => { api(`/tags/${code}`).then(setPet).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro ao carregar.")); }, [code]);
  useEffect(() => { if (pet?.isOwner) api(`/pets/${pet.petId}/scans`).then(setScans).catch(() => {}); }, [pet?.isOwner, pet?.petId]);
  useEffect(() => {
    if (pet?.isOwner) tagSvg(pet.name, siteUrl(`/p/${code}`)).then((s) => setTagImg(svgToDataUrl(s))).catch(() => setTagImg(""));
  }, [pet?.isOwner, pet?.name, code]);

  if (err) return <p className="text-center py-16 text-stone-600">{err}</p>;
  if (!pet) return <div className="card h-96 animate-pulse bg-stone-100 max-w-md mx-auto" />;

  const found = async () => {
    setBusy(true);
    try {
      const p = await currentPosition();
      await api(`/tags/${code}/found`, { body: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), message: msg.trim() || null } });
      setSent(true);
    } catch (e) { toast(e instanceof ApiError ? e.message : (e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto pb-10">
      {pet.lostAlertId && (
        <div className="rounded-2xl bg-red-600 text-white p-4 mb-4">
          <p className="font-extrabold text-lg">{pet.name} está desaparecido!</p>
          <p className="text-sm">Se ele está com você, avise o tutor agora.</p>
        </div>
      )}
      {pet.photo ? <img src={media(pet.photo)} alt={pet.name} className="w-full aspect-square object-cover rounded-2xl" /> : <div className="w-full aspect-square bg-stone-200 rounded-2xl" />}
      <h1 className="text-3xl font-extrabold mt-3">{pet.name}</h1>
      <p className="text-stone-600">{[SPECIES[pet.species], pet.breed, pet.size ? SIZES[pet.size] : null, pet.color].filter(Boolean).join(" · ")}</p>

      {pet.isOwner ? (
        <div className="space-y-3 mt-4">
          <div className="card p-4">
            <p className="font-bold">Esta é a página do {pet.name}</p>
            <p className="text-sm text-stone-600">É exatamente o que aparece para quem ler o QR da plaquinha. Você vê aqui as ferramentas que só o tutor tem.</p>
            <div className="flex items-center gap-4 mt-3">
              {tagImg ? <img src={tagImg} alt={`Plaquinha de ${pet.name}`} className="w-28 h-28 shrink-0" /> : <div className="w-28 h-28 rounded-full bg-stone-100 animate-pulse shrink-0" />}
              <div className="text-sm text-stone-600 min-w-0">
                <p>O QR desta plaquinha leva para este endereço:</p>
                <p className="text-xs text-brand-700 font-semibold break-all mt-1">{siteUrl(`/p/${code}`)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button type="button" className="btn-primary" onClick={() => printTag(pet.name, siteUrl(`/p/${code}`))}><Printer className="w-4 h-4" />Imprimir</button>
              {pet.lostAlertId
                ? <Link to={`/caso/${pet.lostAlertId}`} className="btn-ghost">Ver meu alerta</Link>
                : <Link to={`/publicar?pet=${pet.petId}`} className="btn-danger"><Siren className="w-4 h-4" />Ele se perdeu</Link>}
            </div>
            <p className="text-xs text-stone-500 mt-3 flex gap-2"><Scissors className="w-4 h-4 shrink-0" />Recorte no tamanho que caber na coleira e use um porta-plaquinha transparente para pendurar.</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button type="button" className="btn-ghost" onClick={() => setEditPet(true)}><Pencil className="w-4 h-4" />Editar pet</button>
              <button type="button" className="btn-ghost text-red-700" onClick={() => setDelPet(true)}><Trash2 className="w-4 h-4" />Excluir pet</button>
            </div>
          </div>
          <div className="card p-4">
            <p className="font-bold">Leituras da plaquinha ({scans.length})</p>
            {scans.length === 0 && <p className="text-sm text-stone-500">Ninguém leu a plaquinha ainda. Quando alguém tocar em "Encontrei este pet", o local aparece aqui e você é avisado.</p>}
            {scans.length > 0 && <div className="mt-2"><MapView height={200} title={`Leituras da plaquinha de ${pet.name}`} points={scans.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, color: COLORS.scan, label: dateTime(s.createdAt) }))} /></div>}
            <ul className="text-sm mt-2 space-y-1">{scans.map((s) => <li key={s.id}>📍 {dateTime(s.createdAt)}{s.message ? ` · "${s.message}"` : ""}</li>)}</ul>
          </div>
        </div>
      ) : sent ? (
        <div className="card p-5 mt-4 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
          <p className="font-extrabold text-lg mt-2">O tutor foi avisado!</p>
          <p className="text-sm text-stone-600">Ele recebeu sua localização{msg ? " e seu recado" : ""}. Obrigado por ajudar {pet.name} a voltar para casa.</p>
          {pet.lostAlertId && <Link to={`/caso/${pet.lostAlertId}`} className="btn-primary w-full mt-4">Conversar com o tutor</Link>}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <label className="label" htmlFor="m">Recado para o tutor (opcional)</label>
          <input id="m" className="input" maxLength={300} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Ex.: está comigo na padaria da esquina" />
          <button type="button" className="btn-danger w-full h-14 text-lg" disabled={busy} onClick={found}>{busy ? "Enviando..." : "Encontrei este pet"}</button>
          <p className="text-xs text-stone-500">Sua localização só é enviada se você tocar no botão. Não precisa de conta.</p>
          {pet.lostAlertId && <Link to={`/caso/${pet.lostAlertId}`} className="btn-ghost w-full">Ver o alerta de desaparecimento</Link>}
        </div>
      )}
      {pet.isOwner && (
        <>
          <Modal open={editPet} onClose={() => setEditPet(false)} title={`Editar ${pet.name}`}>
            <PetForm pet={{ ...pet, id: pet.petId, tagCode: code ?? "" }} onCancel={() => setEditPet(false)}
              onDone={() => { setEditPet(false); api(`/tags/${code}`).then(setPet).catch(() => {}); }} />
          </Modal>
          <ConfirmModal open={delPet} title={`Excluir ${pet.name}?`} confirmLabel="Excluir pet" onClose={() => setDelPet(false)}
            onConfirm={async () => {
              try { await api(`/pets/${pet.petId}`, { method: "DELETE" }); toast(`${pet.name} foi excluído.`); nav("/resgate"); }
              catch (e) { toast(e instanceof ApiError ? e.message : "Não foi possível excluir.", "error"); }
            }}>
            <p>O cadastro e a foto serão apagados e a plaquinha impressa <b>deixa de funcionar</b>. As leituras da plaquinha também são apagadas.</p>
            {pet.lostAlertId && <p className="text-red-700 font-semibold">Este pet tem um alerta ativo. O alerta continua publicado, sem o vínculo com o cadastro.</p>}
            <p>Essa ação não pode ser desfeita.</p>
          </ConfirmModal>
        </>
      )}
    </div>
  );
}
