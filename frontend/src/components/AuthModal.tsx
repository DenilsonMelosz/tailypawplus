import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Modal } from "./Modal";
import { CityFields } from "./CityFields";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import * as v from "../lib/validate";

type Errors = Record<string, string>;
const EMPTY = { name: "", email: "", password: "", city: "", uf: "", receiveAlerts: true };

/** So o formulario de entrar/criar conta. Usado na pagina /entrar e /cadastro e na janela de entrada. */
export function AuthForm({ mode, onSwitch, onSuccess, reason }: { mode: "login" | "register"; onSwitch: () => void; onSuccess: () => void; reason?: string }) {
  const { login, register } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setErrors({}); setErr(""); setShow(false); }, [mode]);

  const set = (k: keyof typeof EMPTY, val: string | boolean) => {
    setF((s) => ({ ...s, [k]: val }));
    setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; });
    setErr("");
  };

  const validate = (): Errors => v.clean(mode === "login"
    ? { email: v.email(f.email), password: f.password ? undefined : "Informe a senha." }
    : {
      name: v.name(f.name, "nome"), email: v.email(f.email), password: v.password(f.password),
      uf: f.uf ? undefined : "Escolha o estado.", city: f.city ? undefined : "Escolha a cidade na lista.",
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setErr(""); setBusy(true);
    try {
      if (mode === "login") await login(f.email.trim(), f.password);
      else await register({ ...f, name: f.name.trim(), email: f.email.trim() });
      onSuccess();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Não foi possível entrar.");
    } finally { setBusy(false); }
  };

  return (
    <div>
      {reason && <p className="text-sm text-stone-600 mb-3">{reason}</p>}
      <form onSubmit={submit} className="space-y-3" noValidate>
        {mode === "register" && (
          <div>
            <label className="label" htmlFor="name">Seu nome *</label>
            <input id="name" className={`input ${errors.name ? "!border-red-500" : ""}`} value={f.name} maxLength={80} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">E-mail *</label>
          <input id="email" type="email" inputMode="email" className={`input ${errors.email ? "!border-red-500" : ""}`} value={f.email} maxLength={120} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Senha *</label>
          <div className="relative">
            <input id="password" type={show ? "text" : "password"} className={`input pr-11 ${errors.password ? "!border-red-500" : ""}`} value={f.password} maxLength={100}
              onChange={(e) => set("password", e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder a senha" : "Mostrar a senha"} className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full text-stone-500 hover:bg-stone-100 flex items-center justify-center cursor-pointer">
              {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password ? <p className="field-error">{errors.password}</p> : mode === "register" && <p className="text-xs text-stone-500 mt-1">Pelo menos 6 caracteres.</p>}
        </div>
        {mode === "register" && (
          <>
            <CityFields idPrefix="reg" city={f.city} uf={f.uf} onChange={(city, uf) => { setF((s) => ({ ...s, city, uf })); setErrors((e) => { const n = { ...e }; delete n.city; delete n.uf; return n; }); }} errors={{ city: errors.city, uf: errors.uf }} />
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input type="checkbox" className="mt-1 w-4 h-4 accent-[#0F7F8C]" checked={f.receiveAlerts} onChange={(e) => set("receiveAlerts", e.target.checked)} />
              <span>Quero receber alertas de pets perdidos e avistados na minha cidade.</span>
            </label>
          </>
        )}
        {err && <p className="field-error" role="alert">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
      </form>
      <p className="text-sm text-center mt-4">
        {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
        <button type="button" className="font-bold text-brand-600 cursor-pointer" onClick={onSwitch}>
          {mode === "login" ? "Criar conta" : "Entrar"}
        </button>
      </p>
    </div>
  );
}

export function AuthModal() {
  const { loginPrompt, closeLogin } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  useEffect(() => { if (loginPrompt.open) setMode(loginPrompt.mode ?? "login"); }, [loginPrompt.open, loginPrompt.mode]);
  return (
    <Modal open={loginPrompt.open} onClose={() => closeLogin(false)} title={mode === "login" ? "Entrar" : "Criar conta"}>
      <AuthForm mode={mode} reason={loginPrompt.reason} onSwitch={() => setMode(mode === "login" ? "register" : "login")} onSuccess={() => closeLogin(true)} />
    </Modal>
  );
}
