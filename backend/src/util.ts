import { randomUUID, randomBytes, createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";

export const uuid = () => randomUUID();

/** Regiao e sempre "Cidade, UF": a chave ignora acentos e maiusculas. */
export function cityKey(city: string, uf: string) {
  return `${city.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ")}|${uf.trim().toUpperCase()}`;
}

/** Codigo da plaquinha: curto, sem caracteres ambiguos. */
export function tagCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const b = randomBytes(8);
  return Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
}

/** RN03: ponto a ate ~200 m do real, sempre o mesmo para o mesmo alerta. */
export function approximate(id: string, lat: number, lng: number) {
  const h = createHash("sha256").update(id).digest();
  const angle = (h.readUInt16BE(0) / 65535) * 2 * Math.PI;
  const meters = 80 + (h.readUInt16BE(2) / 65535) * 120;
  const dLat = (meters * Math.cos(angle)) / 111_320;
  const dLng = (meters * Math.sin(angle)) / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { lat: +(lat + dLat).toFixed(4), lng: +(lng + dLng).toFixed(4) };
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("JWT_SECRET nao configurado");
  return s ?? "dev-secret-tailypawplus";
};

export const signToken = (userId: string) => jwt.sign({ sub: userId }, SECRET(), { expiresIn: "30d" });

export interface AuthedRequest extends Request {
  userId?: string;
}

/** Le o token se houver (rotas publicas que aceitam usuario logado). */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) {
    try {
      req.userId = (jwt.verify(h.slice(7), SECRET()) as jwt.JwtPayload).sub as string;
    } catch {
      /* token invalido: segue como anonimo */
    }
  }
  next();
}

/** RNF05: publicar, conversar e encerrar exigem conta. */
export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  optionalAuth(req, _res, () => {
    if (!req.userId) return next(new HttpError(401, "Entre na sua conta para continuar."));
    next();
  });
}

export const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ message: first?.message ?? "Dados inválidos.", field: first?.path.join(".") });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message, ...err.extra });
  if ((err as any)?.type === "entity.too.large") return res.status(413).json({ message: "Arquivo grande demais." });
  console.error(err);
  res.status(500).json({ message: "Erro inesperado. Tente de novo." });
}
