import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Printer, Scissors } from "lucide-react";
import { Modal } from "./Modal";
import { siteUrl } from "./QrImage";
import { printTag } from "../lib/print";
import { svgToDataUrl, tagSvg } from "../lib/tagArt";
import type { Pet } from "../lib/types";

/** Plaquinha do pet: previa, orientacao de recorte e impressao. */
export function TagModal({ pet, onClose }: { pet: Pet | null; onClose: () => void }) {
  const [img, setImg] = useState("");
  const url = pet ? siteUrl(`/p/${pet.tagCode}`) : "";
  useEffect(() => {
    if (!pet) return;
    setImg("");
    tagSvg(pet.name, url).then((s) => setImg(svgToDataUrl(s))).catch(() => setImg(""));
  }, [pet?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pet) return null;
  return (
    <Modal open onClose={onClose} title={`Plaquinha de ${pet.name}`}>
      <div className="flex flex-col items-center text-center">
        {img ? <img src={img} alt={`Plaquinha de ${pet.name} com QR Code`} className="w-60 h-60" /> : <div className="w-60 h-60 rounded-full bg-stone-100 animate-pulse" />}
        <p className="text-sm text-stone-600 mt-3">Quem ler o QR abre a <b>página do {pet.name}</b> e pode avisar você com a localização, sem precisar de conta.</p>
        <p className="text-xs text-stone-400 mt-1 break-all">{url}</p>
        <div className="mt-3 rounded-xl bg-stone-50 border border-stone-200 p-3 text-left text-sm text-stone-700 flex gap-2 w-full">
          <Scissors className="w-4 h-4 mt-0.5 shrink-0 text-stone-500" />
          <span>Imprima, recorte no tamanho que caber na coleira e coloque num <b>porta-plaquinha transparente</b> para pendurar.</span>
        </div>
        <div className="flex gap-2 mt-4 w-full">
          <Link className="btn-ghost flex-1" to={`/p/${pet.tagCode}`} onClick={onClose}><ExternalLink className="w-4 h-4" />Página do pet</Link>
          <button type="button" className="btn-primary flex-1" onClick={() => printTag(pet.name, url)}><Printer className="w-4 h-4" />Imprimir</button>
        </div>
      </div>
    </Modal>
  );
}
