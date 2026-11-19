import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { AuthModal } from "./components/AuthModal";
import Resgate from "./pages/Resgate";
import Publicar from "./pages/Publicar";
import { CasoPage, TagPage } from "./pages/Caso";
import Conversas from "./pages/Conversas";

/** Quatro telas: T1 Resgate, T2 Publicar alerta, T3 Caso do pet (tambem aberta pela plaquinha), T4 Conversa. */
export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-4">
        <Routes>
          <Route path="/" element={<Resgate />} />
          <Route path="/publicar" element={<Publicar />} />
          <Route path="/caso/:id" element={<CasoPage />} />
          <Route path="/p/:code" element={<TagPage />} />
          <Route path="/conversas" element={<Conversas />} />
          <Route path="/conversas/:id" element={<Conversas />} />
          <Route path="*" element={<p className="text-center py-20 text-stone-500">Página não encontrada.</p>} />
        </Routes>
      </main>
      <AuthModal />
    </div>
  );
}
