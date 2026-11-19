import { Router } from "express";
import { z } from "zod";
import { one, q } from "../db.js";
import { notify } from "../services.js";
import { HttpError, requireAuth, uuid, wrap } from "../util.js";

/* ------------------------------------------------------------------ notificacoes */
export const notifications = Router();
notifications.get("/", requireAuth, wrap(async (req, res) => {
  const items = await q(`SELECT id, kind, title, body, link, read_at, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [req.userId]);
  const unread = await one<{ n: string }>(`SELECT COUNT(*)::text AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL`, [req.userId]);
  res.json({ unread: Number(unread?.n ?? 0), items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: !!n.read_at, createdAt: n.created_at })) });
}));
notifications.post("/read", requireAuth, wrap(async (req, res) => {
  await q(`UPDATE notifications SET read_at = NOW() WHERE user_id=$1 AND read_at IS NULL`, [req.userId]);
  res.json({ ok: true });
}));

/* ------------------------------------------------------------------ conversas (T4, RF08) */
export async function getOrCreateConversation(alertId: string | null, userA: string, userB: string) {
  const [a, b] = [userA, userB].sort();
  const found = await one<{ id: string }>(
    `SELECT id FROM conversations WHERE user_a=$1 AND user_b=$2 AND alert_id IS NOT DISTINCT FROM $3::uuid`, [a, b, alertId]);
  if (found) return found.id;
  const id = uuid();
  await q(`INSERT INTO conversations (id, alert_id, user_a, user_b) VALUES ($1,$2,$3,$4)`, [id, alertId, a, b]);
  return id;
}

async function member(convId: string, userId: string) {
  const c = await one(`SELECT * FROM conversations WHERE id=$1`, [convId]);
  if (!c || (c.user_a !== userId && c.user_b !== userId)) throw new HttpError(404, "Conversa não encontrada.");
  return c;
}

export const conversations = Router();

conversations.post("/", requireAuth, wrap(async (req, res) => {
  const b = z.object({ alertId: z.string().uuid() }).parse(req.body);
  const a = await one(`SELECT author_id FROM alerts WHERE id=$1`, [b.alertId]);
  if (!a) throw new HttpError(404, "Alerta não encontrado.");
  if (a.author_id === req.userId) throw new HttpError(400, "Este alerta é seu.");
  res.json({ id: await getOrCreateConversation(b.alertId, req.userId!, a.author_id) });
}));

conversations.get("/", requireAuth, wrap(async (req, res) => {
  const rows = await q(`
    SELECT c.id, c.alert_id, c.last_message_at,
      u.id AS other_id, u.name AS other_name,
      al.animal_name, al.type, al.species, al.image_ids,
      (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_body
    FROM conversations c
    JOIN users u ON u.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
    LEFT JOIN alerts al ON al.id = c.alert_id
    WHERE c.user_a = $1 OR c.user_b = $1
    ORDER BY c.last_message_at DESC`, [req.userId]);
  res.json(rows.map((c) => ({
    id: c.id, alertId: c.alert_id, lastMessageAt: c.last_message_at, lastMessage: c.last_body,
    other: { id: c.other_id, name: c.other_name },
    alert: c.alert_id ? { animalName: c.animal_name, type: c.type, species: c.species, image: String(c.image_ids || "").split(",").filter(Boolean).map((i: string) => `/api/images/${i}`)[0] ?? null } : null,
  })));
}));

conversations.get("/:id/messages", requireAuth, wrap(async (req, res) => {
  await member(req.params.id, req.userId!);
  const after = typeof req.query.after === "string" ? req.query.after : null;
  const rows = after
    ? await q(`SELECT * FROM messages WHERE conversation_id=$1 AND created_at > $2 ORDER BY created_at`, [req.params.id, after])
    : await q(`SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at`, [req.params.id]);
  res.json(rows.map((m) => ({ id: m.id, body: m.body, mine: m.sender_id === req.userId, createdAt: m.created_at })));
}));

conversations.post("/:id/messages", requireAuth, wrap(async (req, res) => {
  const c = await member(req.params.id, req.userId!);
  const b = z.object({ body: z.string().trim().min(1, "Escreva uma mensagem.").max(1000) }).parse(req.body);
  const id = uuid();
  const m = await one(`INSERT INTO messages (id, conversation_id, sender_id, body) VALUES ($1,$2,$3,$4) RETURNING *`, [id, c.id, req.userId, b.body]);
  await q(`UPDATE conversations SET last_message_at = NOW() WHERE id=$1`, [c.id]);
  const other = c.user_a === req.userId ? c.user_b : c.user_a;
  // um aviso por conversa a cada 2 minutos, para nao inundar o sino
  const recent = await one(`SELECT 1 FROM notifications WHERE user_id=$1 AND link=$2 AND created_at > NOW() - INTERVAL '2 minutes'`, [other, `/conversas/${c.id}`]);
  if (!recent) {
    const me = await one(`SELECT name FROM users WHERE id=$1`, [req.userId]);
    await notify(other, "message", `Nova mensagem de ${me?.name ?? "alguém"}`, b.body.slice(0, 120), `/conversas/${c.id}`);
  }
  res.status(201).json({ id: m!.id, body: m!.body, mine: true, createdAt: m!.created_at });
}));
