import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, LogOut, MapPinned, MessageCircle, PawPrint, Settings2, Siren, UserRound } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { ago } from "../lib/format";
import type { Notification } from "../lib/types";

export function Header() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [notif, setNotif] = useState<{ unread: number; items: Notification[] }>({ unread: 0, items: [] });
  const [openBell, setOpenBell] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { setNotif({ unread: 0, items: [] }); return; }
    let alive = true;
    const load = () => api<{ unread: number; items: Notification[] }>("/notifications").then((n) => alive && setNotif(n)).catch(() => {});
    load();
    const t = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpenBell(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggleBell = async () => {
    const next = !openBell;
    setOpenBell(next);
    if (next && notif.unread) {
      await api("/notifications/read", { method: "POST" }).catch(() => {});
      setNotif((n) => ({ ...n, unread: 0 }));
    }
  };

  return (
    <header className="sticky top-0 z-[1000] bg-white/95 backdrop-blur border-b border-stone-200 no-print">
      <div className="max-w-5xl mx-auto h-16 px-4 flex items-center gap-2">
        <Link to={user ? "/resgate" : "/"} className="flex items-center" aria-label="TailyPaw+ - início">
          <img src="/logo_horizontal.png" alt="TailyPaw+" className="h-11 w-auto" />
        </Link>
        <div className="flex-1" />
        {user ? (
          <>
            <Link to="/resgate" className="w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center" aria-label="Mapa da cidade"><MapPinned className="w-5 h-5" /></Link>
            <Link to="/conversas" className="w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center" aria-label="Conversas"><MessageCircle className="w-5 h-5" /></Link>
            <div className="relative" ref={bellRef}>
              <button type="button" onClick={toggleBell} className="relative w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center cursor-pointer" aria-label={`Notificações${notif.unread ? `: ${notif.unread} novas` : ""}`}>
                <Bell className="w-5 h-5" />
                {notif.unread > 0 && <span className="absolute top-1 right-1 min-w-5 h-5 px-1 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center">{notif.unread}</span>}
              </button>
              {openBell && (
                <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[360px] card overflow-hidden">
                  <p className="px-4 py-3 font-bold border-b border-stone-100">Notificações</p>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {notif.items.length === 0 && <p className="px-4 py-6 text-sm text-stone-500">Nenhuma notificação por enquanto.</p>}
                    {notif.items.map((n) => (
                      <button key={n.id} type="button" onClick={() => { setOpenBell(false); if (n.link) nav(n.link); }}
                        className={`w-full text-left px-4 py-3 border-b border-stone-100 hover:bg-stone-50 cursor-pointer ${n.read ? "" : "bg-brand-50"}`}>
                        <p className="font-semibold text-sm">{n.title}</p>
                        <p className="text-sm text-stone-600">{n.body}</p>
                        <p className="text-xs text-stone-400 mt-1">{ago(n.createdAt)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setOpenMenu((o) => !o)} aria-haspopup="menu" aria-expanded={openMenu} className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center cursor-pointer" aria-label="Menu da conta">
                {user.name.trim()[0]?.toUpperCase() ?? <UserRound className="w-5 h-5" />}
              </button>
              {openMenu && (
                <div role="menu" className="absolute right-0 mt-2 w-64 card overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-100">
                    <p className="font-bold truncate">{user.name}</p>
                    <p className="text-xs text-stone-500 truncate">{user.email}</p>
                  </div>
                  {[
                    { to: "/conta?aba=pets", label: "Meus pets e plaquinhas", Icon: PawPrint },
                    { to: "/conta?aba=alertas", label: "Meus alertas", Icon: Siren },
                    { to: "/conta?aba=dados", label: "Meus dados e preferências", Icon: Settings2 },
                  ].map(({ to, label, Icon }) => (
                    <Link key={to} role="menuitem" to={to} onClick={() => setOpenMenu(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-stone-50"><Icon className="w-4 h-4 text-brand-600" />{label}</Link>
                  ))}
                  <button type="button" role="menuitem" onClick={() => { setOpenMenu(false); logout(); nav("/"); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 border-t border-stone-100 cursor-pointer"><LogOut className="w-4 h-4" />Sair da conta</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/cadastro" className="hidden sm:inline-flex h-10 items-center px-4 text-sm font-bold text-brand-700">Criar conta</Link>
            <Link to="/entrar" className="btn-primary h-10">Entrar</Link>
          </>
        )}
      </div>
    </header>
  );
}
