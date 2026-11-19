import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthForm } from "../components/AuthModal";
import { useAuth } from "../lib/auth";

/** Paginas /entrar e /cadastro: so o formulario, sem mapa nem lista por tras. */
export default function Entrar({ mode }: { mode: "login" | "register" }) {
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  const dest = from && from.startsWith("/") ? from : "/resgate";
  if (ready && user) return <Navigate to={dest} replace />;
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 bg-white">
      <Link to="/" aria-label="TailyPaw+ - início"><img src="/logo_horizontal.png" alt="TailyPaw+" className="h-14 w-auto" /></Link>
      <div className="card w-full max-w-md p-6 mt-6">
        <h1 className="font-extrabold text-2xl mb-1">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="text-sm text-stone-600 mb-4">{from ? "Entre para continuar." : mode === "login" ? "Entre para ver os casos da sua cidade." : "Crie sua conta para ver e publicar alertas."}</p>
        <AuthForm mode={mode} onSuccess={() => nav(dest, { replace: true })}
          onSwitch={() => nav(mode === "login" ? "/cadastro" : "/entrar", { state: loc.state, replace: true })} />
      </div>
      <Link to="/" className="text-sm font-semibold text-brand-600 mt-4">Voltar para o início</Link>
    </div>
  );
}
