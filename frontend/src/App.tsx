import { Route, Routes, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { AuthModal } from "./components/AuthModal";
import Home from "./pages/Home";
import Entrar from "./pages/Entrar";
import Resgate from "./pages/Resgate";
import Conta from "./pages/Conta";
import { PrivateRoute } from "./components/PrivateRoute";
import Publicar from "./pages/Publicar";
import { CasoPage, TagPage } from "./pages/Caso";
import Conversas from "./pages/Conversas";

/** Quatro telas: T1 Resgate, T2 Publicar alerta, T3 Caso do pet (tambem aberta pela plaquinha), T4 Conversa. */
export default function App() {
  const { pathname } = useLocation();
  const soFormulario = pathname === "/entrar" || pathname === "/cadastro";
  return (
    <div className="min-h-full flex flex-col">
      {!soFormulario && <Header />}
      <main className={soFormulario ? "flex-1 w-full" : "flex-1 w-full max-w-5xl mx-auto px-4 py-4"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/entrar" element={<Entrar mode="login" />} />
          <Route path="/cadastro" element={<Entrar mode="register" />} />
          <Route path="/caso/:id" element={<CasoPage />} />
          <Route path="/p/:code" element={<TagPage />} />
          <Route element={<PrivateRoute />}>
            <Route path="/resgate" element={<Resgate />} />
            <Route path="/conta" element={<Conta />} />
            <Route path="/publicar" element={<Publicar />} />
            <Route path="/conversas" element={<Conversas />} />
            <Route path="/conversas/:id" element={<Conversas />} />
          </Route>
          <Route path="*" element={<p className="text-center py-20 text-stone-500">Página não encontrada.</p>} />
        </Routes>
      </main>
      <AuthModal />
    </div>
  );
}
