import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { UFS } from "../lib/format";
import { loadCities } from "../lib/cities";
import { Select } from "./Select";

/**
 * Regiao e sempre "Cidade, UF". Primeiro o estado, depois a cidade, escolhida na lista
 * oficial de municipios do estado (IBGE): nao e possivel digitar um nome livre.
 */
export function CityFields({ city, uf, onChange, errors, idPrefix = "loc", compact = false }: {
  city: string; uf: string; onChange: (city: string, uf: string) => void; errors?: { city?: string; uf?: string }; idPrefix?: string; compact?: boolean;
}) {
  const [list, setList] = useState<{ uf: string; cities: string[]; partial: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!uf) { setList(null); return; }
    let alive = true;
    setLoading(true);
    loadCities(uf).then((r) => { if (alive) { setList({ uf, ...r }); setLoading(false); } });
    return () => { alive = false; };
  }, [uf, tick]);

  const cities = useMemo(() => {
    const base = list?.uf === uf ? list.cities : [];
    // cidade ja salva na conta que nao esta na lista continua aparecendo
    return city && !base.includes(city) && base.length ? [city, ...base] : base;
  }, [list, uf, city]);

  const options = useMemo(() => cities.map((c) => ({ value: c, label: c })), [cities]);
  const ufOptions = useMemo(() => UFS.map((u) => ({ value: u, label: u })), []);

  return (
    <div>
      <div className={`grid gap-2 ${compact ? "grid-cols-[96px_1fr]" : "grid-cols-[104px_1fr]"}`}>
        <div>
          {!compact && <label className="label" htmlFor={`${idPrefix}-uf`}>Estado *</label>}
          <Select id={`${idPrefix}-uf`} ariaLabel="Estado (UF)" value={uf} placeholder="UF" invalid={!!errors?.uf} options={ufOptions}
            onChange={(v) => onChange(v === uf ? city : "", v)} />
          {errors?.uf && <p className="field-error">{errors.uf}</p>}
        </div>
        <div>
          {!compact && <label className="label" htmlFor={`${idPrefix}-city`}>Cidade *</label>}
          <Select id={`${idPrefix}-city`} ariaLabel="Cidade" value={city} searchable disabled={!uf} loading={loading} invalid={!!errors?.city}
            placeholder={uf ? "Escolha a cidade" : "Escolha o estado primeiro"} options={options}
            emptyText="Nenhuma cidade com esse nome." onChange={(v) => onChange(v, uf)} />
          {errors?.city && <p className="field-error">{errors.city}</p>}
        </div>
      </div>
      {list?.partial && uf && (
        <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
          Não foi possível carregar todas as cidades agora.
          <button type="button" className="font-bold underline cursor-pointer inline-flex items-center gap-1" onClick={() => setTick((t) => t + 1)}><RefreshCw className="w-3 h-3" />Tentar de novo</button>
        </p>
      )}
    </div>
  );
}
