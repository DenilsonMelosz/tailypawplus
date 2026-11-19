export type Species = "cao" | "gato" | "outro";
export type Size = "pequeno" | "medio" | "grande";
export type Sex = "macho" | "femea" | "nao_sei";

export interface User { id: string; name: string; email: string; city: string; uf: string; receiveAlerts: boolean }

export interface Alert {
  id: string;
  type: "perdido" | "avistado";
  status: "aberto" | "resolvido" | "arquivado";
  petId: string | null;
  animalName: string | null;
  species: Species;
  breed: string;
  color: string | null;
  size: Size | null;
  sex: Sex | null;
  description: string;
  reward: string | null;
  city: string;
  uf: string;
  lat: number;
  lng: number;
  approximate: boolean;
  lastSeenAt: string | null;
  images: string[];
  createdAt: string;
  confirmationRequestedAt: string | null;
  tagCode: string | null;
  author: { id: string; name: string };
  isMine: boolean;
}

export interface Pet {
  id: string; name: string; species: Species; breed: string; color: string | null; size: Size | null; sex: Sex | null;
  photo: string | null; tagCode: string; openAlertId?: string | null;
}

export interface Notification { id: string; kind: string; title: string; body: string; link: string | null; read: boolean; createdAt: string }

export interface Conversation {
  id: string; alertId: string | null; lastMessageAt: string; lastMessage: string | null;
  other: { id: string; name: string };
  alert: { animalName: string | null; type: string; species: Species; image: string | null } | null;
}

export interface Message { id: string; body: string; mine: boolean; createdAt: string }

export interface Person { id: string; name: string; city: string; uf: string; following: boolean; followsMe: boolean }
