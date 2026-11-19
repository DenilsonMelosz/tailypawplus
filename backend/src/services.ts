import { one, q } from "./db.js";
import { approximate, uuid } from "./util.js";

export async function notify(userId: string, kind: string, title: string, body: string, link?: string) {
  await q(`INSERT INTO notifications (id, user_id, kind, title, body, link) VALUES ($1,$2,$3,$4,$5,$6)`, [
    uuid(), userId, kind, title, body, link ?? null,
  ]);
}

export const SPECIES_LABEL: Record<string, string> = { cao: "cão", gato: "gato", outro: "pet" };

/* ------------------------------------------------------------------ ciclo de vida (RN05 / RN06) */
const unitMs = () => (process.env.LIFECYCLE_UNIT === "minutes" ? 60_000 : 86_400_000);
const confirmAfter = () => Number(process.env.LIFECYCLE_CONFIRM ?? 5);
const archiveAfter = () => Number(process.env.LIFECYCLE_ARCHIVE ?? 5);
export const lifecycleInfo = () => ({
  unit: process.env.LIFECYCLE_UNIT === "minutes" ? "minutos" : "dias",
  confirmAfter: confirmAfter(),
  archiveAfter: archiveAfter(),
});

let lastRun = 0;
/**
 * Roda no maximo a cada 20 s. Como o servidor gratuito "dorme", a regra e
 * aplicada pelas datas gravadas, e nao por um relogio: o resultado e o mesmo.
 */
export async function runLifecycle(force = false) {
  if (!force && Date.now() - lastRun < 20_000) return;
  lastRun = Date.now();
  const cAfter = new Date(Date.now() - confirmAfter() * unitMs()).toISOString();
  const aAfter = new Date(Date.now() - archiveAfter() * unitMs()).toISOString();

  const toAsk = await q<{ id: string; author_id: string; animal_name: string | null; species: string }>(
    `UPDATE alerts SET confirmation_requested_at = NOW()
     WHERE type = 'perdido' AND status = 'aberto' AND confirmation_requested_at IS NULL AND last_confirmed_at <= $1
     RETURNING id, author_id, animal_name, species`,
    [cAfter],
  );
  for (const a of toAsk) {
    const name = a.animal_name ?? `Seu ${SPECIES_LABEL[a.species] ?? "pet"}`;
    await notify(a.author_id, "confirm", `${name} continua desaparecido?`,
      `Confirme em até ${archiveAfter()} ${lifecycleInfo().unit} ou o alerta será arquivado.`, `/caso/${a.id}`);
  }

  const archived = await q<{ id: string; author_id: string; animal_name: string | null }>(
    `UPDATE alerts SET status = 'arquivado'
     WHERE type = 'perdido' AND status = 'aberto' AND confirmation_requested_at IS NOT NULL AND confirmation_requested_at <= $1
     RETURNING id, author_id, animal_name`,
    [aAfter],
  );
  for (const a of archived) {
    await notify(a.author_id, "archived", "Alerta arquivado",
      `O alerta${a.animal_name ? ` de ${a.animal_name}` : ""} saiu do mapa por falta de confirmação. Você pode reativá-lo.`, `/caso/${a.id}`);
  }
}

/* ------------------------------------------------------------------ DTO do alerta */
export function alertDto(a: any, viewerId?: string) {
  const mine = !!viewerId && viewerId === a.author_id;
  const pos = mine ? { lat: a.lat, lng: a.lng } : approximate(a.id, a.lat, a.lng);
  return {
    id: a.id,
    type: a.type,
    status: a.status,
    petId: a.pet_id,
    animalName: a.animal_name,
    species: a.species,
    breed: a.breed,
    color: a.color,
    size: a.size,
    sex: a.sex,
    description: a.description,
    reward: a.type === "perdido" ? a.reward : null,
    city: a.city,
    uf: a.uf,
    lat: pos.lat,
    lng: pos.lng,
    approximate: !mine,
    lastSeenAt: a.last_seen_at,
    images: String(a.image_ids || "").split(",").filter(Boolean).map((id: string) => `/api/images/${id}`),
    createdAt: a.created_at,
    confirmationRequestedAt: mine ? a.confirmation_requested_at : null,
    tagCode: mine ? a.tag_code ?? null : null,
    author: { id: a.author_id, name: a.author_name },
    isMine: mine,
  };
}

export const ALERT_SELECT = `SELECT a.*, u.name AS author_name, p.tag_code
  FROM alerts a JOIN users u ON u.id = a.author_id LEFT JOIN pets p ON p.id = a.pet_id`;

/** RN04: um mesmo pet nao pode ter mais de um alerta ativo. */
export async function findDuplicate(authorId: string, petId: string | null, animalName: string | null, exceptId?: string) {
  if (petId) {
    return one<{ id: string }>(`SELECT id FROM alerts WHERE pet_id = $1 AND status = 'aberto' AND id <> COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000')`, [petId, exceptId ?? null]);
  }
  if (animalName) {
    return one<{ id: string }>(
      `SELECT id FROM alerts WHERE author_id = $1 AND status = 'aberto' AND LOWER(animal_name) = LOWER($2) AND id <> COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000')`,
      [authorId, animalName, exceptId ?? null],
    );
  }
  return undefined;
}
