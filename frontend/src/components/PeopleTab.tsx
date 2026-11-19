import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Search, UserCheck, UserPlus, UsersRound } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Person } from "../lib/types";
import { useToast } from "./Toast";

interface Connections { following: Person[]; followers: Person[] }

function Row({ p, busy, onFollow, onChat }: { p: Person; busy: boolean; onFollow: () => void; onChat: () => void }) {
  return (
    <li className="px-4 py-3 border-b border-stone-100 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center shrink-0">{p.name.trim()[0]?.toUpperCase()}</span>
      <div className="min-w-[140px] flex-1">
        <p className="font-semibold leading-tight break-words">{p.name}</p>
        <p className="text-xs text-stone-500">{p.city}, {p.uf}{p.followsMe && !p.following ? " · segue você" : ""}</p>
      </div>
      <div className="flex items-center gap-2 ml-auto">
      <button type="button" onClick={onChat} aria-label={`Conversar com ${p.name}`} title="Conversar" className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center cursor-pointer"><MessageCircle className="w-4 h-4" /></button>
      <button type="button" disabled={busy} onClick={onFollow} aria-pressed={p.following}
        className={`h-9 px-3 rounded-full text-sm font-bold flex items-center gap-1 cursor-pointer disabled:opacity-60 ${p.following ? "bg-stone-100 text-stone-700 hover:bg-stone-200" : "bg-brand-600 text-white hover:bg-brand-700"}`}>
        {p.following ? <><UserCheck className="w-4 h-4" />Seguindo</> : <><UserPlus className="w-4 h-4" />{p.followsMe ? "Seguir de volta" : "Seguir"}</>}
      </button>
      </div>
    </li>
  );
}

/** Buscar pessoas pelo nome, seguir e abrir uma conversa direta. Nao mostra e-mail nem telefone. */
export function PeopleTab() {
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [conn, setConn] = useState<Connections | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadConn = () => api<Connections>("/users/connections").then(setConn).catch(() => {});
  useEffect(() => { loadConn(); inputRef.current?.focus(); }, []);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    let alive = true;
    const h = setTimeout(() => {
      api<Person[]>(`/users/search?q=${encodeURIComponent(t)}`)
        .then((r) => alive && setResults(r))
        .catch((e) => { if (alive) { setResults([]); toast(e instanceof ApiError ? e.message : "Não foi possível buscar.", "error"); } })
        .finally(() => alive && setSearching(false));
    }, 300);
    return () => { alive = false; clearTimeout(h); };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (p: Person) => {
    setBusyId(p.id);
    try {
      await api(`/users/${p.id}/follow`, { method: p.following ? "DELETE" : "POST" });
      const flip = (x: Person) => (x.id === p.id ? { ...x, following: !p.following } : x);
      setResults((r) => r && r.map(flip));
      await loadConn();
      toast(p.following ? `Você deixou de seguir ${p.name}.` : `Você agora segue ${p.name}.`);
    } catch (e) { toast(e instanceof ApiError ? e.message : "Não foi possível concluir.", "error"); }
    finally { setBusyId(null); }
  };

  const chat = async (p: Person) => {
    try { const c = await api<{ id: string }>("/conversations", { body: { userId: p.id } }); nav(`/conversas/${c.id}`); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Não foi possível abrir a conversa.", "error"); }
  };

  const list = (title: string, people: Person[], empty: string) => (
    <section>
      <p className="px-4 pt-4 pb-1 text-xs font-extrabold uppercase tracking-wide text-stone-500">{title} ({people.length})</p>
      {people.length === 0 ? <p className="px-4 pb-3 text-sm text-stone-500">{empty}</p> : (
        <ul>{people.map((p) => <Row key={p.id} p={p} busy={busyId === p.id} onFollow={() => toggle(p)} onChat={() => chat(p)} />)}</ul>
      )}
    </section>
  );

  return (
    <div>
      <div className="p-3 border-b border-stone-100">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input ref={inputRef} type="search" className="input pl-9" placeholder="Buscar pessoa pelo nome" aria-label="Buscar pessoa pelo nome" maxLength={60} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="text-xs text-stone-500 mt-1">Digite pelo menos 2 letras. Só o nome e a cidade aparecem.</p>
      </div>

      {q.trim().length >= 2 ? (
        <div>
          {searching && <p className="px-4 py-4 text-sm text-stone-500">Buscando...</p>}
          {!searching && results?.length === 0 && (
            <div className="px-4 py-8 text-center text-stone-500"><UsersRound className="w-8 h-8 mx-auto text-stone-300" /><p className="mt-2 text-sm">Ninguém encontrado com "{q.trim()}".</p></div>
          )}
          {!searching && results && results.length > 0 && <ul>{results.map((p) => <Row key={p.id} p={p} busy={busyId === p.id} onFollow={() => toggle(p)} onChat={() => chat(p)} />)}</ul>}
        </div>
      ) : (
        conn ? <>{list("Seguindo", conn.following, "Você ainda não segue ninguém. Busque pelo nome acima.")}{list("Seguidores", conn.followers, "Ninguém segue você ainda.")}</> : <p className="px-4 py-4 text-sm text-stone-500">Carregando...</p>
      )}
    </div>
  );
}
