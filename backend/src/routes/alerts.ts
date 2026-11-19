import { Router } from "express";
import { z } from "zod";
import { one, q } from "../db.js";
import { ALERT_SELECT, SPECIES_LABEL, alertDto, findDuplicate, lifecycleInfo, notify } from "../services.js";
import { HttpError, cityKey, optionalAuth, requireAuth, uuid, wrap } from "../util.js";
import { getOrCreateConversation } from "./social.js";

const r = Router();

/* T1 Resgate: alertas abertos da cidade (RF04). */
r.get("/", optionalAuth, wrap(async (req, res) => {
  const f = z.object({
    city: z.string().optional(), uf: z.string().optional(),
    type: z.enum(["perdido", "avistado", "todos"]).default("todos"),
  }).parse(req.query);
  let key: string | null = null;
  if (f.city && f.uf) key = cityKey(f.city, f.uf);
  else if (req.userId) key = (await one(`SELECT city_key FROM users WHERE id=$1`, [req.userId]))?.city_key ?? null;
  const params: unknown[] = [];
  let where = `a.status = 'aberto'`;
  if (key) { params.push(key); where += ` AND a.city_key = $${params.length}`; }
  if (f.type !== "todos") { params.push(f.type); where += ` AND a.type = $${params.length}`; }
  const rows = await q(`${ALERT_SELECT} WHERE ${where} ORDER BY a.created_at DESC LIMIT 200`, params);
  res.json(rows.map((a) => alertDto(a, req.userId)));
}));

r.get("/mine", requireAuth, wrap(async (req, res) => {
  const rows = await q(`${ALERT_SELECT} WHERE a.author_id = $1 ORDER BY a.created_at DESC`, [req.userId]);
  res.json(rows.map((a) => alertDto(a, req.userId)));
}));

r.get("/lifecycle", (_req, res) => res.json(lifecycleInfo()));

r.get("/:id", optionalAuth, wrap(async (req, res) => {
  const a = await one(`${ALERT_SELECT} WHERE a.id = $1`, [req.params.id]);
  if (!a) throw new HttpError(404, "Alerta não encontrado.");
  res.json(alertDto(a, req.userId));
}));

/* T2 Publicar alerta (RF01, RF02, RF03) */
const AlertBody = z.object({
  type: z.enum(["perdido", "avistado"]),
  petId: z.string().uuid().nullish(),
  animalName: z.string().trim().max(60).nullish(),
  species: z.enum(["cao", "gato", "outro"]).default("cao"),
  breed: z.string().trim().max(60).nullish(),
  color: z.string().trim().max(60).nullish(),
  size: z.enum(["pequeno", "medio", "grande"]).nullish(),
  sex: z.enum(["macho", "femea", "nao_sei"]).nullish(),
  description: z.string().trim().min(1, "A descrição é obrigatória.").max(1000),
  reward: z.string().trim().max(80, "A recompensa pode ter no máximo 80 caracteres.").nullish(),
  city: z.string().trim().min(2, "A cidade é obrigatória.").max(80),
  uf: z.string().trim().length(2, "O estado (UF) é obrigatório.").transform((s) => s.toUpperCase()),
  lat: z.number({ required_error: "Marque no mapa onde o pet foi visto.", invalid_type_error: "Marque no mapa onde o pet foi visto." }).min(-90).max(90),
  lng: z.number({ required_error: "Marque no mapa onde o pet foi visto.", invalid_type_error: "Marque no mapa onde o pet foi visto." }).min(-180).max(180),
  lastSeenAt: z.string().datetime().nullish(),
  imageIds: z.array(z.string().uuid()).max(5, "No máximo 5 fotos.").default([]),
});

r.post("/", requireAuth, wrap(async (req, res) => {
  const b = AlertBody.parse(req.body);
  let { animalName, species, breed, color, size, sex } = b;
  let imageIds = [...b.imageIds];
  if (b.petId) {
    const pet = await one(`SELECT * FROM pets WHERE id=$1 AND owner_id=$2`, [b.petId, req.userId]);
    if (!pet) throw new HttpError(400, "Pet não encontrado na sua conta.");
    animalName = pet.name; species = pet.species; breed = pet.breed;
    color = color || pet.color; size = (size || pet.size) as any; sex = (sex || pet.sex) as any;
    if (!imageIds.length && pet.photo_id) imageIds = [pet.photo_id];
  }
  // RN01
  if (!imageIds.length) throw new HttpError(400, "Adicione pelo menos uma foto.", { field: "imageIds" });
  if (!b.petId && !breed) throw new HttpError(400, "Informe a raça ou se é SRD.", { field: "breed" });
  if (b.type === "perdido" && !b.petId && !animalName) throw new HttpError(400, "Informe o nome do pet.", { field: "animalName" });
  const owned = await q(`SELECT id FROM images WHERE id = ANY($1::uuid[]) AND owner_id = $2`, [imageIds, req.userId]);
  if (owned.length !== new Set(imageIds).size) throw new HttpError(400, "Foto inválida. Envie de novo.");
  // RN04
  const dup = await findDuplicate(req.userId!, b.petId ?? null, animalName ?? null);
  if (dup) throw new HttpError(409, "Esse pet já tem um alerta ativo. Marque o anterior como resolvido antes de publicar outro.", { existingId: dup.id });
  // RN08
  const reward = b.type === "perdido" && b.reward ? b.reward : null;

  const id = uuid();
  await q(`INSERT INTO alerts (id, author_id, type, pet_id, animal_name, species, breed, color, size, sex, description, reward,
      city, uf, city_key, lat, lng, last_seen_at, image_ids)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [id, req.userId, b.type, b.petId ?? null, animalName || null, species, breed || "SRD", color || null, size || null, sex || null,
      b.description, reward, b.city, b.uf, cityKey(b.city, b.uf), b.lat, b.lng, b.lastSeenAt ?? null, imageIds.join(",")]);

  // RN02: avisa a cidade
  const targets = await q<{ id: string }>(`SELECT id FROM users WHERE city_key = $1 AND receive_alerts = TRUE AND id <> $2`,
    [cityKey(b.city, b.uf), req.userId]);
  const who = animalName ? `${animalName} (${SPECIES_LABEL[species]})` : `Um ${SPECIES_LABEL[species]}`;
  const title = b.type === "perdido" ? "Pet perdido perto de você" : "Pet avistado perto de você";
  const body = b.type === "perdido" ? `${who} foi dado como perdido em ${b.city}. Fique de olho!` : `${who} foi avistado em ${b.city}. Será que é de alguém que você conhece?`;
  for (const t of targets) await notify(t.id, "radar", title, body, `/caso/${id}`);

  const a = await one(`${ALERT_SELECT} WHERE a.id = $1`, [id]);
  res.status(201).json({ ...alertDto(a, req.userId), notified: targets.length });
}));

async function ownAlert(id: string, userId: string) {
  const a = await one(`SELECT * FROM alerts WHERE id = $1`, [id]);
  if (!a) throw new HttpError(404, "Alerta não encontrado.");
  if (a.author_id !== userId) throw new HttpError(403, "Só quem publicou pode fazer isso."); // RN07
  return a;
}

/* RF10: marcar como resolvido (RN07) */
r.post("/:id/resolve", requireAuth, wrap(async (req, res) => {
  await ownAlert(req.params.id, req.userId!);
  await q(`UPDATE alerts SET status='resolvido', resolved_at=NOW() WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

r.delete("/:id", requireAuth, wrap(async (req, res) => {
  await ownAlert(req.params.id, req.userId!);
  await q(`DELETE FROM alerts WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

/* RN05: "continua desaparecido" zera o prazo */
r.post("/:id/confirm", requireAuth, wrap(async (req, res) => {
  const a = await ownAlert(req.params.id, req.userId!);
  if (a.status !== "aberto") throw new HttpError(400, "Este alerta não está ativo.");
  await q(`UPDATE alerts SET last_confirmed_at=NOW(), confirmation_requested_at=NULL WHERE id=$1`, [a.id]);
  res.json({ ok: true, message: "Obrigado por confirmar. Seguimos procurando!" });
}));

/* RN06: alerta arquivado pode ser reativado */
r.post("/:id/reactivate", requireAuth, wrap(async (req, res) => {
  const a = await ownAlert(req.params.id, req.userId!);
  if (a.status !== "arquivado") throw new HttpError(400, "Só alertas arquivados podem ser reativados.");
  const dup = await findDuplicate(a.author_id, a.pet_id, a.animal_name, a.id);
  if (dup) throw new HttpError(409, "Esse pet já tem outro alerta ativo.", { existingId: dup.id });
  await q(`UPDATE alerts SET status='aberto', last_confirmed_at=NOW(), confirmation_requested_at=NULL WHERE id=$1`, [a.id]);
  res.json({ ok: true });
}));

/* RF11: "Sou o dono" em alerta de avistado (RN09) */
r.post("/:id/claim", requireAuth, wrap(async (req, res) => {
  const a = await one(`SELECT * FROM alerts WHERE id=$1`, [req.params.id]);
  if (!a) throw new HttpError(404, "Alerta não encontrado.");
  if (a.type !== "avistado" || a.status !== "aberto") throw new HttpError(400, "Este alerta não aceita essa ação.");
  if (a.author_id === req.userId) throw new HttpError(400, "Você é o autor desta publicação.");
  const me = await one(`SELECT name FROM users WHERE id=$1`, [req.userId]);
  const conv = await getOrCreateConversation(a.id, req.userId!, a.author_id);
  await q(`INSERT INTO messages (id, conversation_id, sender_id, body) VALUES ($1,$2,$3,$4)`,
    [uuid(), conv, req.userId, "Olá! Acho que este pet é meu. Podemos conversar?"]);
  await q(`UPDATE conversations SET last_message_at = NOW() WHERE id=$1`, [conv]);
  await notify(a.author_id, "claim", "Alguém disse ser o dono do pet!", `${me?.name ?? "Uma pessoa"} sinalizou que é o dono do pet que você avistou.`, `/conversas/${conv}`);
  res.json({ conversationId: conv });
}));

export default r;
