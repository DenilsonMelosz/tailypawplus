import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { one, q } from "../db.js";
import { notify } from "../services.js";
import { HttpError, optionalAuth, requireAuth, tagCode, uuid, wrap } from "../util.js";

/* ------------------------------------------------------------------ fotos */
export const images = Router();
const MAX_B64 = 1_600_000; // ~1,2 MB por foto (o site reduz antes de enviar)

images.post("/", requireAuth, wrap(async (req, res) => {
  const b = z.object({ dataUrl: z.string() }).parse(req.body);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.dataUrl);
  if (!m) throw new HttpError(400, "Envie uma foto JPG, PNG ou WEBP.");
  if (m[2].length > MAX_B64) throw new HttpError(413, "Foto grande demais.");
  const id = uuid();
  await q(`INSERT INTO images (id, owner_id, mime, data) VALUES ($1,$2,$3,$4)`, [id, req.userId, m[1], m[2]]);
  res.status(201).json({ id, url: `/api/images/${id}` });
}));

images.get("/:id", wrap(async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) throw new HttpError(404, "Foto não encontrada.");
  const img = await one(`SELECT mime, data FROM images WHERE id=$1`, [req.params.id]);
  if (!img) throw new HttpError(404, "Foto não encontrada.");
  res.setHeader("Content-Type", img.mime);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(img.data, "base64"));
}));

/* ------------------------------------------------------------------ pets e plaquinha */
const petDto = (p: any) => ({
  id: p.id, name: p.name, species: p.species, breed: p.breed, color: p.color, size: p.size, sex: p.sex,
  photo: p.photo_id ? `/api/images/${p.photo_id}` : null, tagCode: p.tag_code,
});

export const pets = Router();

/** Apaga a foto do pet quando nenhum alerta a usa mais (minimizacao de dados, LGPD). */
async function dropImageIfUnused(imageId: string | null | undefined) {
  if (!imageId) return;
  await q(`DELETE FROM images WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM alerts WHERE image_ids LIKE '%' || $1 || '%')
    AND NOT EXISTS (SELECT 1 FROM pets WHERE photo_id=$1)`, [imageId]);
}

pets.get("/", requireAuth, wrap(async (req, res) => {
  const rows = await q(`SELECT p.*, (SELECT id FROM alerts a WHERE a.pet_id = p.id AND a.status='aberto' LIMIT 1) AS open_alert
    FROM pets p WHERE owner_id=$1 ORDER BY created_at`, [req.userId]);
  res.json(rows.map((p) => ({ ...petDto(p), openAlertId: p.open_alert })));
}));

pets.post("/", requireAuth, wrap(async (req, res) => {
  const b = z.object({
    name: z.string().trim().min(1, "Informe o nome do pet.").max(60),
    species: z.enum(["cao", "gato", "outro"]),
    breed: z.string().trim().min(1, "Informe a raça ou se é SRD.").max(60),
    color: z.string().trim().max(60).nullish(),
    size: z.enum(["pequeno", "medio", "grande"]).nullish(),
    sex: z.enum(["macho", "femea", "nao_sei"]).nullish(),
    photoId: z.string().uuid().nullish(),
  }).parse(req.body);
  if (b.photoId && !(await one(`SELECT 1 FROM images WHERE id=$1 AND owner_id=$2`, [b.photoId, req.userId]))) throw new HttpError(400, "Foto inválida.");
  const id = uuid();
  let code = tagCode();
  while (await one(`SELECT 1 FROM pets WHERE tag_code=$1`, [code])) code = tagCode();
  const p = await one(`INSERT INTO pets (id, owner_id, name, species, breed, color, size, sex, photo_id, tag_code)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, req.userId, b.name, b.species, b.breed, b.color ?? null, b.size ?? null, b.sex ?? null, b.photoId ?? null, code]);
  res.status(201).json(petDto(p));
}));

/* RF14: o tutor edita nome, foto e demais dados do pet. A plaquinha (codigo) nao muda. */
pets.patch("/:id", requireAuth, wrap(async (req, res) => {
  const b = z.object({
    name: z.string().trim().min(1, "Informe o nome do pet.").max(60).optional(),
    species: z.enum(["cao", "gato", "outro"]).optional(),
    breed: z.string().trim().min(1, "Informe a raça ou se é SRD.").max(60).optional(),
    color: z.string().trim().max(60).nullish(),
    size: z.enum(["pequeno", "medio", "grande"]).nullish(),
    sex: z.enum(["macho", "femea", "nao_sei"]).nullish(),
    photoId: z.string().uuid().nullish(),
  }).parse(req.body);
  const cur = await one(`SELECT * FROM pets WHERE id=$1 AND owner_id=$2`, [req.params.id, req.userId]);
  if (!cur) throw new HttpError(404, "Pet não encontrado.");
  if (b.photoId && b.photoId !== cur.photo_id && !(await one(`SELECT 1 FROM images WHERE id=$1 AND owner_id=$2`, [b.photoId, req.userId]))) throw new HttpError(400, "Foto inválida.");
  const has = (k: keyof typeof b) => b[k] !== undefined;
  const next = {
    name: b.name ?? cur.name, species: b.species ?? cur.species, breed: b.breed ?? cur.breed,
    color: has("color") ? b.color || null : cur.color, size: has("size") ? b.size ?? null : cur.size,
    sex: has("sex") ? b.sex ?? null : cur.sex, photo_id: has("photoId") ? b.photoId ?? null : cur.photo_id,
  };
  const p = await one(`UPDATE pets SET name=$2, species=$3, breed=$4, color=$5, size=$6, sex=$7, photo_id=$8 WHERE id=$1 RETURNING *`,
    [cur.id, next.name, next.species, next.breed, next.color, next.size, next.sex, next.photo_id]);
  // alerta ativo do pet continua coerente com o cadastro
  await q(`UPDATE alerts SET animal_name=$2, species=$3, breed=$4, color=$5, size=$6, sex=$7 WHERE pet_id=$1 AND status='aberto'`,
    [cur.id, next.name, next.species, next.breed, next.color, next.size, next.sex]);
  if (cur.photo_id && cur.photo_id !== next.photo_id) await dropImageIfUnused(cur.photo_id);
  res.json(petDto(p));
}));

/* RF15: o tutor apaga o pet. A plaquinha deixa de abrir e as leituras sao apagadas; alertas antigos ficam sem o vinculo. */
pets.delete("/:id", requireAuth, wrap(async (req, res) => {
  const cur = await one(`SELECT * FROM pets WHERE id=$1 AND owner_id=$2`, [req.params.id, req.userId]);
  if (!cur) throw new HttpError(404, "Pet não encontrado.");
  await q(`DELETE FROM pets WHERE id=$1`, [cur.id]);
  await dropImageIfUnused(cur.photo_id);
  res.json({ ok: true });
}));

/* Leituras da plaquinha: so o tutor ve (RF07). */
pets.get("/:id/scans", requireAuth, wrap(async (req, res) => {
  const p = await one(`SELECT id FROM pets WHERE id=$1 AND owner_id=$2`, [req.params.id, req.userId]);
  if (!p) throw new HttpError(404, "Pet não encontrado.");
  const rows = await q(`SELECT * FROM scans WHERE pet_id=$1 ORDER BY created_at DESC LIMIT 50`, [p.id]);
  res.json(rows.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, accuracy: s.accuracy, message: s.message, createdAt: s.created_at })));
}));

/* Pagina publica da plaquinha (RNF03: abre sem login). */
export const tags = Router();

tags.get("/:code", optionalAuth, wrap(async (req, res) => {
  const p = await one(`SELECT p.*, (SELECT id FROM alerts a WHERE a.pet_id=p.id AND a.type='perdido' AND a.status='aberto' LIMIT 1) AS lost_alert
    FROM pets p WHERE tag_code=$1`, [req.params.code.toUpperCase()]);
  if (!p) throw new HttpError(404, "Plaquinha não encontrada.");
  res.json({ ...petDto(p), tagCode: undefined, lostAlertId: p.lost_alert, isOwner: req.userId === p.owner_id, petId: p.id });
}));

const scanLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

/* RN10: a localizacao so chega aqui se a pessoa tocar em "Encontrei este pet". */
tags.post("/:code/found", scanLimiter, optionalAuth, wrap(async (req, res) => {
  const b = z.object({
    lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
    accuracy: z.number().int().min(0).max(100_000).nullish(),
    message: z.string().trim().max(300).nullish(),
  }).parse(req.body);
  const p = await one(`SELECT * FROM pets WHERE tag_code=$1`, [req.params.code.toUpperCase()]);
  if (!p) throw new HttpError(404, "Plaquinha não encontrada.");
  await q(`INSERT INTO scans (id, pet_id, lat, lng, accuracy, message, scanner_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [uuid(), p.id, b.lat, b.lng, b.accuracy ?? null, b.message || null, req.userId ?? null]);
  if (p.owner_id !== req.userId) {
    const note = b.message ? ` Recado: "${b.message}"` : "";
    await notify(p.owner_id, "scan", `📍 Alguém encontrou ${p.name}`, `Uma pessoa leu a plaquinha e enviou a localização. Toque para ver no mapa.${note}`, `/p/${p.tag_code}`);
  }
  res.status(201).json({ ok: true });
}));
