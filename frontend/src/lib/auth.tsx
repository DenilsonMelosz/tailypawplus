import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, getToken, setToken } from "./api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; city: string; uf: string; receiveAlerts: boolean }) => Promise<void>;
  logout: () => void;
  update: (u: User) => void;
  /** Abre a janela de login; resolve true quando a pessoa entra. */
  requireLogin: (reason?: string, mode?: "login" | "register") => Promise<boolean>;
  loginPrompt: { open: boolean; reason?: string; mode?: "login" | "register" };
  closeLogin: (ok: boolean) => void;
}

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [prompt, setPrompt] = useState<{ open: boolean; reason?: string; mode?: "login" | "register"; resolve?: (ok: boolean) => void }>({ open: false });

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api<User>("/me").then(setUser).catch((e) => {
      if (e instanceof ApiError && e.status === 401) setToken(null);
    }).finally(() => setReady(true));
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/login", { body: { email, password } });
    setToken(r.token); setUser(r.user);
  };
  const register: AuthCtx["register"] = async (data) => {
    const r = await api<{ token: string; user: User }>("/auth/register", { body: data });
    setToken(r.token); setUser(r.user);
  };
  const logout = () => { setToken(null); setUser(null); };

  const requireLogin = useCallback((reason?: string, mode?: "login" | "register") => {
    if (user) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setPrompt({ open: true, reason, mode, resolve }));
  }, [user]);
  const closeLogin = (ok: boolean) => { prompt.resolve?.(ok); setPrompt({ open: false }); };

  return (
    <Ctx.Provider value={{ user, ready, login, register, logout, update: setUser, requireLogin, loginPrompt: prompt, closeLogin }}>
      {children}
    </Ctx.Provider>
  );
}
