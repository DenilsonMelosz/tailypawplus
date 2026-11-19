import { Router } from "express";
import { z } from "zod";
import { one, q } from "../db.js";
import { notify } from "../services.js";
import { HttpError, requireAuth, wrap } from "../util.js";

/** Buscar pessoas e seguir. Nunca devolve e-mail nem telefone. */
const r = Router();

const personDto = (u: any) => ({ id: u.id, name: u.name, city: u.city, uf: u.uf, following: !!u.i_follow, followsMe: !!u.follows_me });

const PERSON = `SELECT u.id, u.name, u.city, u.uf,
  EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followed_id = u.id) AS i_follow,
  EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followed_id = $1) AS follows_me
  FROM users u`;

r.get("/search", requireAuth, wrap(async (req, res) => {
  const text = z.string().trim().min(2, "Digite pelo menos 2 letras.").max(60).parse(req.query.q ?? "");
  const like = `%${text.replace(/[\%_]/g, (c) => `\${c}`)}%`;
  const rows = await q(`${PERSON} WHERE u.id <> $1 AND u.name ILIKE $2 ORDER BY u.name LIMIT 20`, [req.userId, like]);
  res.json(rows.map(personDto));
}));

r.get("/connections", requireAuth, wrap(async (req, res) => {
  const following = await q(`${PERSON} WHERE u.id IN (SELECT followed_id FROM follows WHERE follower_id = $1) ORDER BY u.name`, [req.userId]);
  const followers = await q(`${PERSON} WHERE u.id IN (SELECT follower_id FROM follows WHERE followed_id = $1) ORDER BY u.name`, [req.userId]);
  res.json({ following: following.map(personDto), followers: followers.map(personDto) });
}));

r.post("/:id/follow", requireAuth, wrap(async (req, res) => {
  const id = z.string().uuid("Pessoa inválida.").parse(req.params.id);
  if (id === req.userId) throw new HttpError(400, "Você não pode seguir a si mesmo.");
  if (!(await one(`SELECT 1 FROM users WHERE id=$1`, [id]))) throw new HttpError(404, "Pessoa não encontrada.");
  const added = await one(`INSERT INTO follows (follower_id, followed_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING follower_id`, [req.userId, id]);
  if (added) {
    const me = await one(`SELECT name FROM users WHERE id=$1`, [req.userId]);
    await notify(id, "follow", "Novo seguidor", `${me?.name ?? "Alguém"} começou a seguir você.`, "/conversas?aba=pessoas");
  }
  res.json({ following: true });
}));

r.delete("/:id/follow", requireAuth, wrap(async (req, res) => {
  const id = z.string().uuid("Pessoa inválida.").parse(req.params.id);
  await q(`DELETE FROM follows WHERE follower_id=$1 AND followed_id=$2`, [req.userId, id]);
  res.json({ following: false });
}));

export default r;
