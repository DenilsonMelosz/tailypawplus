import type { Alert, Sex, Size, Species } from "./types";

export const SPECIES: Record<Species, string> = { cao: "Cão", gato: "Gato", outro: "Outro" };
export const SIZES: Record<Size, string> = { pequeno: "Pequeno", medio: "Médio", grande: "Grande" };
export const SEXES: Record<Sex, string> = { macho: "Macho", femea: "Fêmea", nao_sei: "Não sei" };

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function alertTitle(a: Pick<Alert, "animalName" | "species" | "type">) {
  if (a.animalName) return a.animalName;
  return a.type === "avistado" ? `${SPECIES[a.species]} avistado` : `${SPECIES[a.species]} perdido`;
}

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Sempre uma leitura nova da posicao (nunca a posicao guardada). */
export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Seu navegador não informa a localização."));
    navigator.geolocation.getCurrentPosition(resolve, (e) => {
      reject(new Error(e.code === 1 ? "Permita o acesso à localização para continuar." : "Não foi possível obter sua localização."));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
}

export const SALVADOR: [number, number] = [-12.9777, -38.5016];
