import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { one, q } from "../db.js";
import { HttpError, cityKey, requireAuth, signToken, uuid, wrap } from "../util.js";

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: true, legacyHeaders: false });

const UF = z.string().trim().length(2, "Escolha o estado (UF).").transform((s) => s.toUpperCase());
const City = z.string().trim().min(2, "Informe a cidade.").max(80);

const NameField = z.string().trim().min(2, "Informe seu nome.").max(80);
const userDto = (u: any) => ({ id: u.id, name: u.name, email: u.email, city: u.city, uf: u.uf, receiveAlerts: u.receive_alerts });

r.post("/register", limiter, wrap(async (req, res) => {
  const b = z.object({
    name: z.string().trim().min(2, "Informe seu nome.").max(80),
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
    password: z.string().min(6, "A senha precisa de pelo menos 6 caracteres.").max(100),
    city: City,
    uf: UF,
    receiveAlerts: z.boolean().default(true),
  }).parse(req.body);
  if (await one(`SELECT 1 FROM users WHERE email = $1`, [b.email])) throw new HttpError(409, "Já existe uma conta com esse e-mail.");
  const id = uuid();
  const hash = await bcrypt.hash(b.password, 10);
  await q(`INSERT INTO users (id, name, email, password_hash, city, uf, city_key, receive_alerts) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, b.name, b.email, hash, b.city, b.uf, cityKey(b.city, b.uf), b.receiveAlerts]);
  const u = await one(`SELECT * FROM users WHERE id = $1`, [id]);
  res.status(201).json({ token: signToken(id), user: userDto(u) });
}));

r.post("/login", limiter, wrap(async (req, res) => {
  const b = z.object({ email: z.string().trim().toLowerCase(), password: z.string() }).parse(req.body);
  const u = await one(`SELECT * FROM users WHERE email = $1`, [b.email]);
  if (!u || !(await bcrypt.compare(b.password, u.password_hash))) throw new HttpError(401, "E-mail ou senha incorretos.");
  res.json({ token: signToken(u.id), user: userDto(u) });
}));

export const me = Router();
me.get("/", requireAuth, wrap(async (req, res) => {
  const u = await one(`SELECT * FROM users WHERE id = $1`, [req.userId]);
  if (!u) throw new HttpError(401, "Sessão expirada. Entre de novo.");
  res.json(userDto(u));
}));
me.patch("/", requireAuth, wrap(async (req, res) => {
  const b = z.object({
    name: NameField.optional(), city: City.optional(), uf: UF.optional(), receiveAlerts: z.boolean().optional(),
    currentPassword: z.string().max(100).optional(),
    newPassword: z.string().min(6, "A nova senha precisa de pelo menos 6 caracteres.").max(100).optional(),
  }).parse(req.body);
  const u = await one(`SELECT * FROM users WHERE id = $1`, [req.userId]);
  if (!u) throw new HttpError(401, "Sessão expirada.");
  let hash = u.password_hash;
  if (b.newPassword) {
    if (!b.currentPassword || !(await bcrypt.compare(b.currentPassword, u.password_hash))) throw new HttpError(403, "A senha atual está incorreta.", { field: "currentPassword" });
    hash = await bcrypt.hash(b.newPassword, 10);
  }
  const city = b.city ?? u.city, uf = b.uf ?? u.uf;
  const n = await one(`UPDATE users SET name=$2, city=$3, uf=$4, city_key=$5, receive_alerts=$6, password_hash=$7 WHERE id=$1 RETURNING *`,
    [req.userId, b.name ?? u.name, city, uf, cityKey(city, uf), b.receiveAlerts ?? u.receive_alerts, hash]);
  res.json(userDto(n));
}));

/* RF16 (LGPD, direito de acesso e portabilidade): copia dos dados da propria pessoa. */
me.get("/export", requireAuth, wrap(async (req, res) => {
  const u = await one(`SELECT * FROM users WHERE id = $1`, [req.userId]);
  if (!u) throw new HttpError(401, "Sessão expirada.");
  const pets = await q(`SELECT name, species, breed, color, size, sex, created_at FROM pets WHERE owner_id=$1 ORDER BY created_at`, [u.id]);
  const alerts = await q(`SELECT type, status, animal_name, species, breed, description, city, uf, created_at, resolved_at FROM alerts WHERE author_id=$1 ORDER BY created_at`, [u.id]);
  const messages = await q(`SELECT body, created_at FROM messages WHERE sender_id=$1 ORDER BY created_at`, [u.id]);
  const following = await q(`SELECT u.name FROM follows f JOIN users u ON u.id=f.followed_id WHERE f.follower_id=$1`, [u.id]);
  res.setHeader("Content-Disposition", 'attachment; filename="meus-dados-tailypaw.json"');
  res.json({ geradoEm: new Date().toISOString(), conta: { ...userDto(u), criadaEm: u.created_at }, pets, alertas: alerts, mensagensEnviadas: messages, seguindo: following.map((f) => f.name) });
}));

/* RF16 (LGPD, direito de eliminacao): apaga a conta e tudo que depende dela, com confirmacao pela senha. */
me.delete("/", requireAuth, wrap(async (req, res) => {
  const b = z.object({ password: z.string().min(1, "Informe a senha para confirmar.").max(100) }).parse(req.body);
  const u = await one(`SELECT * FROM users WHERE id = $1`, [req.userId]);
  if (!u) throw new HttpError(401, "Sessão expirada.");
  if (!(await bcrypt.compare(b.password, u.password_hash))) throw new HttpError(403, "Senha incorreta.", { field: "password" });
  // pets, alertas, fotos, notificacoes, conversas, mensagens, seguidores e leituras saem em cascata
  await q(`DELETE FROM users WHERE id=$1`, [u.id]);
  res.json({ ok: true });
}));

export default r;
