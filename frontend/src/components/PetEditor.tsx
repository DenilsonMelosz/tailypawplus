import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Select } from "./Select";
import { useToast } from "./Toast";
import { api, ApiError, media, uploadImage } from "../lib/api";
import { IMAGE_ACCEPT } from "../lib/files";
import { SEXES, SIZES, SPECIES } from "../lib/format";
import type { Pet, Sex, Size, Species } from "../lib/types";
import * as v from "../lib/validate";

const opts = (o: Record<string, string>, empty?: string) => [...(empty ? [{ value: "", label: empty }] : []), ...Object.entries(o).map(([value, label]) => ({ value, label }))];

/** Cadastro e edicao do pet (RF13, RF14). Com `pet`, edita; sem, cadastra. */
export function PetForm({ pet, onDone, onCancel }: { pet?: Pet; onDone: (p: Pet) => void; onCancel?: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: pet?.name ?? "", species: (pet?.species ?? "cao") as Species, breed: pet?.breed ?? "", color: pet?.color ?? "",
    size: (pet?.size ?? "") as Size | "", sex: (pet?.sex ?? "") as Sex | "",
  });
  // undefined = nao mexeu na foto; null = tirou; objeto = foto nova
  const [photo, setPhoto] = useState<{ id: string; url: string } | null | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, val: string) => { setF((s) => ({ ...s, [k]: val })); setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; }); };

  const shownPhoto = photo === undefined ? (pet?.photo ? media(pet.photo) : "") : photo ? media(photo.url) : "";

  const pick = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try { setPhoto(await uploadImage(file)); setErrors((e) => { const n = { ...e }; delete n.photo; return n; }); }
    catch (er) { setErrors((e) => ({ ...e, photo: er instanceof ApiError ? er.message : "Falha ao enviar a foto." })); }
    finally { setUploading(false); }
  };

  const save = async () => {
    const e = v.clean({
      name: f.name.trim() ? v.maxLen(f.name, 60, "Nome") : "Informe o nome do pet.",
      breed: f.breed.trim() ? v.maxLen(f.breed, 60, "Raça") : "Informe a raça ou escreva SRD.",
      color: v.maxLen(f.color, 60, "Cor e sinais"),
    });
    setErrors((old) => ({ ...e, ...(old.photo ? { photo: old.photo } : {}) }));
    if (Object.keys(e).length) return;
    setBusy(true);
    const body: Record<string, unknown> = {
      name: f.name.trim(), species: f.species, breed: f.breed.trim(), color: f.color.trim() || null,
      size: f.size || null, sex: f.sex || null,
    };
    if (photo !== undefined) body.photoId = photo?.id ?? null;
    try {
      const saved = pet ? await api<Pet>(`/pets/${pet.id}`, { method: "PATCH", body }) : await api<Pet>("/pets", { body });
      toast(pet ? "Dados do pet salvos." : "Pet cadastrado. Imprima a plaquinha!");
      onDone({ ...saved, openAlertId: pet?.openAlertId });
    } catch (er) { toast(er instanceof ApiError ? er.message : "Não foi possível salvar.", "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="card p-3 mb-3 space-y-3">
      <div className="flex items-center gap-3">
        {shownPhoto ? <img src={shownPhoto} alt="Foto do pet" className="w-20 h-20 rounded-xl object-cover shrink-0" /> : <div className="w-20 h-20 rounded-xl bg-stone-200 shrink-0 flex items-center justify-center text-stone-400"><ImagePlus className="w-6 h-6" /></div>}
        <div className="flex-1 min-w-0 space-y-2">
          <label className="btn-ghost w-full h-9 text-sm">
            <ImagePlus className="w-4 h-4" />{uploading ? "Enviando..." : shownPhoto ? "Trocar foto" : "Adicionar foto"}
            <input type="file" accept={IMAGE_ACCEPT} className="hidden" disabled={uploading} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {shownPhoto && <button type="button" className="text-sm font-bold text-red-600 flex items-center gap-1 cursor-pointer" onClick={() => setPhoto(null)}><Trash2 className="w-4 h-4" />Remover foto</button>}
        </div>
      </div>
      <p className="text-xs text-stone-500 -mt-1">Fotos JPG, PNG ou WEBP.</p>
      {errors.photo && <p className="field-error">{errors.photo}</p>}
      <div>
        <label className="label" htmlFor="pn">Nome do pet *</label>
        <input id="pn" className={`input ${errors.name ? "!border-red-500" : ""}`} maxLength={60} value={f.name} onChange={(e) => set("name", e.target.value)} />
        {errors.name && <p className="field-error">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="ps">Espécie *</label>
          <Select id="ps" value={f.species} options={opts(SPECIES)} onChange={(val) => set("species", val)} />
        </div>
        <div>
          <label className="label" htmlFor="pb">Raça *</label>
          <input id="pb" className={`input ${errors.breed ? "!border-red-500" : ""}`} maxLength={60} placeholder="Ou SRD" value={f.breed} onChange={(e) => set("breed", e.target.value)} />
          {errors.breed && <p className="field-error">{errors.breed}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="pz">Porte</label>
          <Select id="pz" value={f.size} options={opts(SIZES, "Não informar")} onChange={(val) => set("size", val)} />
        </div>
        <div>
          <label className="label" htmlFor="px">Sexo</label>
          <Select id="px" value={f.sex} options={opts(SEXES, "Não informar")} onChange={(val) => set("sex", val)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="pc">Cor e sinais</label>
        <input id="pc" className={`input ${errors.color ? "!border-red-500" : ""}`} maxLength={60} value={f.color} onChange={(e) => set("color", e.target.value)} />
        {errors.color && <p className="field-error">{errors.color}</p>}
      </div>
      <div className="flex gap-2">
        {onCancel && <button type="button" className="btn-ghost flex-1" onClick={onCancel}>Cancelar</button>}
        <button type="button" className="btn-primary flex-1" disabled={busy || uploading} onClick={save}>{busy ? "Salvando..." : pet ? "Salvar alterações" : "Salvar pet"}</button>
      </div>
    </div>
  );
}
