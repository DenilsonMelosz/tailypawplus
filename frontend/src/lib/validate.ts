/** Regras de campo usadas nos formularios (espelham as do servidor). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\+?[\d\s().-]{8,20}$/;

export function name(v: string, label = "nome"): string | undefined {
  const t = v.trim();
  if (!t) return `Informe o ${label}.`;
  if (t.length < 2) return `O ${label} precisa de pelo menos 2 letras.`;
  if (t.length > 80) return `O ${label} pode ter no máximo 80 caracteres.`;
  if (!/\p{L}/u.test(t)) return `O ${label} precisa ter letras.`;
  return undefined;
}

export function email(v: string): string | undefined {
  const t = v.trim();
  if (!t) return "Informe o e-mail.";
  return EMAIL_RE.test(t) ? undefined : "E-mail inválido. Exemplo: nome@email.com";
}

export function password(v: string): string | undefined {
  if (!v) return "Informe a senha.";
  if (v.length < 6) return "A senha precisa de pelo menos 6 caracteres.";
  if (v.length > 100) return "A senha pode ter no máximo 100 caracteres.";
  return undefined;
}

export function maxLen(v: string, n: number, label: string): string | undefined {
  return v.trim().length > n ? `${label}: use no máximo ${n} caracteres.` : undefined;
}

export function phone(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  return PHONE_RE.test(t) && t.replace(/\D/g, "").length >= 8 ? undefined : "Telefone inválido. Exemplo: (71) 99999-0000";
}

/** Tira as chaves sem erro. */
export const clean = (e: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Record<string, string>;
