import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { CityFields } from "./CityFields";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export function AuthModal() {
  const { loginPrompt, closeLogin, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ name: "", email: "", password: "", city: "Salvador", uf: "BA", receiveAlerts: true });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "login") await login(f.email, f.password);
      else await register(f);
      closeLogin(true);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Não foi possível entrar.");
    } finally { setBusy(false); }
  };

  return (
    <Modal open={loginPrompt.open} onClose={() => closeLogin(false)} title={mode === "login" ? "Entrar" : "Criar conta"}>
      {loginPrompt.reason && <p className="text-sm text-stone-600 mb-3">{loginPrompt.reason}</p>}
      <form onSubmit={submit} className="space-y-3">
        {mode === "register" && (
          <div>
            <label className="label" htmlFor="name">Seu nome *</label>
            <input id="name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">E-mail *</label>
          <input id="email" type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha *</label>
          <input id="password" type="password" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {mode === "register" && (
          <>
            <CityFields city={f.city} uf={f.uf} onChange={(city, uf) => setF({ ...f, city, uf })} />
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input type="checkbox" className="mt-1 w-4 h-4 accent-[#0F7F8C]" checked={f.receiveAlerts} onChange={(e) => setF({ ...f, receiveAlerts: e.target.checked })} />
              <span>Quero receber alertas de pets perdidos e avistados na minha cidade.</span>
            </label>
          </>
        )}
        {err && <p className="field-error" role="alert">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
      </form>
      <p className="text-sm text-center mt-4">
        {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
        <button type="button" className="font-bold text-brand-600 cursor-pointer" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
          {mode === "login" ? "Criar conta" : "Entrar"}
        </button>
      </p>
    </Modal>
  );
}
