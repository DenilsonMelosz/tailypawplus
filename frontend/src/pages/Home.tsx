import { Link } from "react-router-dom";
import { Bell, Heart, MapPinned, MessageCircle, QrCode, ShieldCheck, Siren } from "lucide-react";
import { useAuth } from "../lib/auth";

/** Pagina inicial publica: apresenta o MVP e leva para entrar ou criar conta. */
export default function Home() {
  const { user, ready } = useAuth();
  const steps = [
    { Icon: Siren, t: "Publique o alerta", d: "Conte o que aconteceu, com fotos e o local. Leva poucos minutos." },
    { Icon: Bell, t: "A cidade é avisada", d: "Quem mora na mesma cidade e aceitou receber alertas é notificado na hora." },
    { Icon: Heart, t: "Combinem a devolução", d: "Conversem pelo aplicativo, sem expor telefone nem endereço." },
  ];
  const features = [
    { Icon: MapPinned, t: "Mapa da cidade", d: "Pets perdidos e avistados perto de você, só casos ativos." },
    { Icon: MessageCircle, t: "Conversa segura", d: "Fale com quem viu o pet sem mostrar seu telefone." },
    { Icon: QrCode, t: "Plaquinha com QR Code", d: "Quem encontra o pet lê o QR e avisa você, sem instalar nada." },
    { Icon: ShieldCheck, t: "Privacidade", d: "O ponto no mapa é aproximado e só você vê o local exato." },
  ];
  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-12">
      <div className="text-center">
        <span className="chip bg-brand-100 text-brand-700">Reencontro de pets perdidos</span>
        <h1 className="text-3xl sm:text-5xl font-extrabold mt-3 leading-tight">Todo pet perdido tem uma cidade inteira para ajudar.</h1>
        <p className="text-lg text-stone-600 mt-3 max-w-xl mx-auto">O TailyPaw+ avisa os moradores da cidade onde o pet sumiu e liga quem viu o animal ao tutor, com segurança.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          {ready && user ? (
            <Link to="/resgate" className="btn-primary h-12 px-8 text-base">Abrir o mapa da cidade</Link>
          ) : (
            <>
              <Link to="/entrar" className="btn-primary h-12 px-8 text-base">Entrar</Link>
              <Link to="/cadastro" className="btn-accent h-12 px-8 text-base">Criar conta</Link>
            </>
          )}
        </div>
      </div>

      <h2 className="text-xl font-extrabold mt-12 mb-3">Como funciona</h2>
      <ol className="grid sm:grid-cols-3 gap-3">
        {steps.map(({ Icon, t, d }, i) => (
          <li key={t} className="card p-5">
            <span className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center"><Icon className="w-5 h-5" /></span>
            <p className="font-extrabold mt-3">{i + 1}. {t}</p>
            <p className="text-sm text-stone-600 mt-1">{d}</p>
          </li>
        ))}
      </ol>

      <h2 className="text-xl font-extrabold mt-10 mb-3">O que o MVP oferece</h2>
      <ul className="grid sm:grid-cols-2 gap-3">
        {features.map(({ Icon, t, d }) => (
          <li key={t} className="card p-4 flex gap-3 items-start">
            <span className="w-10 h-10 rounded-full bg-orange-50 text-accent flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
            <div><p className="font-extrabold">{t}</p><p className="text-sm text-stone-600">{d}</p></div>
          </li>
        ))}
      </ul>

      <div className="card p-5 mt-4 flex gap-4 items-start">
        <span className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><QrCode className="w-5 h-5" /></span>
        <div>
          <p className="font-extrabold">Achou um pet com a plaquinha na coleira?</p>
          <p className="text-sm text-stone-600">Leia o QR Code com a câmera do celular. A página do pet abre sem precisar de conta, e você avisa o tutor com um toque.</p>
        </div>
      </div>
    </div>
  );
}
