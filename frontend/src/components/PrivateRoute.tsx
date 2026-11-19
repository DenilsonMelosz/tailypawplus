import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

/** Rota privada: sem conta ativa, manda para /entrar e volta para ca depois do login. */
export function PrivateRoute() {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="card h-96 animate-pulse bg-stone-100" />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: loc.pathname + loc.search }} />;
  return <Outlet />;
}
