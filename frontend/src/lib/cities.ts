import { UFS } from "./format";

/** Lista oficial de municipios do IBGE por estado, com copia na sessao. */
const memory = new Map<string, string[]>();

const CAPITALS: Record<string, string> = {
  AC: "Rio Branco", AL: "Maceió", AP: "Macapá", AM: "Manaus", BA: "Salvador", CE: "Fortaleza", DF: "Brasília", ES: "Vitória",
  GO: "Goiânia", MA: "São Luís", MT: "Cuiabá", MS: "Campo Grande", MG: "Belo Horizonte", PA: "Belém", PB: "João Pessoa",
  PR: "Curitiba", PE: "Recife", PI: "Teresina", RJ: "Rio de Janeiro", RN: "Natal", RS: "Porto Alegre", RO: "Porto Velho",
  RR: "Boa Vista", SC: "Florianópolis", SP: "São Paulo", SE: "Aracaju", TO: "Palmas",
};

export const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba",
  PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export interface CityList { cities: string[]; partial: boolean }

export async function loadCities(uf: string): Promise<CityList> {
  if (!UFS.includes(uf)) return { cities: [], partial: false };
  const hit = memory.get(uf);
  if (hit) return { cities: hit, partial: false };
  try {
    const cached = sessionStorage.getItem(`tp_cities_${uf}`);
    if (cached) { const list = JSON.parse(cached) as string[]; memory.set(uf, list); return { cities: list, partial: false }; }
  } catch { /* sem armazenamento */ }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10_000);
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("ibge");
    const list = ((await res.json()) as { nome: string }[]).map((m) => m.nome);
    if (!list.length) throw new Error("vazio");
    memory.set(uf, list);
    try { sessionStorage.setItem(`tp_cities_${uf}`, JSON.stringify(list)); } catch { /* ok */ }
    return { cities: list, partial: false };
  } catch {
    // sem o IBGE, ao menos a capital continua disponivel
    return { cities: [CAPITALS[uf]], partial: true };
  }
}
