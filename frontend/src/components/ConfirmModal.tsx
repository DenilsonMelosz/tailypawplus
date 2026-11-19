import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Modal } from "./Modal";

/** Confirmacao de acao sem volta (apagar pet, apagar conta). Com `askPassword`, pede a senha. */
export function ConfirmModal({ open, title, children, confirmLabel, askPassword, busy, error, onConfirm, onClose }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; askPassword?: boolean; busy?: boolean; error?: string;
  onConfirm: (password: string) => void; onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const close = () => { setPassword(""); setShow(false); onClose(); };
  return (
    <Modal open={open} onClose={close} title={title}>
      <div className="text-sm text-stone-700 space-y-2">{children}</div>
      {askPassword && (
        <div className="mt-4">
          <label className="label" htmlFor="confirm-pw">Sua senha, para confirmar</label>
          <div className="relative">
            <input id="confirm-pw" type={show ? "text" : "password"} className={`input pr-11 ${error ? "!border-red-500" : ""}`} value={password} maxLength={100} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder a senha" : "Mostrar a senha"} className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full text-stone-500 hover:bg-stone-100 flex items-center justify-center cursor-pointer">
              {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="flex gap-2 mt-5">
        <button type="button" className="btn-ghost flex-1" onClick={close}>Cancelar</button>
        <button type="button" className="btn-danger flex-1" disabled={busy || (askPassword && !password)} onClick={() => onConfirm(password)}>{busy ? "Aguarde..." : confirmLabel}</button>
      </div>
    </Modal>
  );
}
