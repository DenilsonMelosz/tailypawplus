import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { api, ApiError, media } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SPECIES, ago } from "../lib/format";
import type { Conversation, Message } from "../lib/types";
import { useToast } from "../components/Toast";

/** T4 Conversa: contato entre tutor e quem viu o pet, sem expor dados (RF08). */
export default function Conversas() {
  const { id } = useParams();
  const { user, ready, requireLogin } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState<Conversation[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) { requireLogin("Entre para ver suas conversas.").then((ok) => !ok && nav("/")); return; }
    const load = () => api<Conversation[]>("/conversations").then(setList).catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [ready, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;
  const current = list?.find((c) => c.id === id) ?? null;

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-7rem)]">
      <aside className={`card overflow-y-auto ${id ? "hidden md:block" : ""}`}>
        <p className="px-4 py-3 font-extrabold border-b border-stone-100">Conversas</p>
        {list?.length === 0 && <p className="p-4 text-sm text-stone-500">Nenhuma conversa ainda. Abra um alerta e toque em "Enviar mensagem".</p>}
        {list?.map((c) => (
          <Link key={c.id} to={`/conversas/${c.id}`} className={`flex gap-3 px-4 py-3 border-b border-stone-100 hover:bg-stone-50 ${c.id === id ? "bg-brand-50" : ""}`}>
            {c.alert?.image ? <img src={media(c.alert.image)} alt="" className="w-11 h-11 rounded-full object-cover" /> : <div className="w-11 h-11 rounded-full bg-stone-200" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{c.other.name}</p>
              <p className="text-xs text-stone-500 truncate">{c.alert ? `sobre: ${c.alert.animalName ?? SPECIES[c.alert.species]}` : ""}</p>
              <p className="text-sm text-stone-600 truncate">{c.lastMessage ?? "Sem mensagens"}</p>
            </div>
            <span className="text-[11px] text-stone-400">{ago(c.lastMessageAt)}</span>
          </Link>
        ))}
      </aside>
      <section className={`card flex flex-col overflow-hidden ${id ? "" : "hidden md:flex"}`}>
        {id ? <Thread id={id} conv={current} /> : <p className="m-auto text-stone-500">Escolha uma conversa.</p>}
      </section>
    </div>
  );
}

function Thread({ id, conv }: { id: string; conv: Conversation | null }) {
  const toast = useToast();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    setMsgs([]); lastRef.current = null; setErr("");
    let alive = true;
    const load = async () => {
      try {
        const qs = lastRef.current ? `?after=${encodeURIComponent(lastRef.current)}` : "";
        const n = await api<Message[]>(`/conversations/${id}/messages${qs}`);
        if (!alive || !n.length) return;
        lastRef.current = n[n.length - 1].createdAt;
        setMsgs((s) => { const ids = new Set(s.map((m) => m.id)); return [...s, ...n.filter((m) => !ids.has(m.id))]; });
      } catch (e) { if (alive) setErr(e instanceof ApiError ? e.message : "Erro ao carregar."); }
    };
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      const m = await api<Message>(`/conversations/${id}/messages`, { body: { body } });
      lastRef.current = m.createdAt;
      setMsgs((s) => [...s, m]);
    } catch (er) { setText(body); toast(er instanceof ApiError ? er.message : "Não enviou.", "error"); }
  };

  if (err) return <p className="m-auto text-stone-500">{err}</p>;
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
        <Link to="/conversas" className="md:hidden" aria-label="Voltar"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="min-w-0">
          <p className="font-bold truncate">{conv?.other.name ?? "Conversa"}</p>
          {conv?.alertId && <Link to={`/caso/${conv.alertId}`} className="text-xs text-brand-600 font-semibold">Ver o alerta {conv.alert?.animalName ? `de ${conv.alert.animalName}` : ""}</Link>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-stone-50">
        {msgs.length === 0 && <p className="text-center text-sm text-stone-500 mt-10">Combine a devolução por aqui. Telefone e endereço não aparecem.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-2 ${m.mine ? "ml-auto bg-brand-100" : "bg-white border border-stone-200"}`}>
            <p className="whitespace-pre-line">{m.body}</p>
            <p className="text-[11px] text-stone-400 text-right">{new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 p-3 border-t border-stone-100">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem" aria-label="Mensagem" maxLength={1000} />
        <button className="btn-primary w-11 px-0 shrink-0" aria-label="Enviar"><Send className="w-5 h-5" /></button>
      </form>
    </>
  );
}
