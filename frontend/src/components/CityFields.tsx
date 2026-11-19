import { UFS } from "../lib/format";

/** Regiao e sempre "Cidade, UF". */
export function CityFields({ city, uf, onChange, errors }: {
  city: string; uf: string; onChange: (city: string, uf: string) => void; errors?: { city?: string; uf?: string };
}) {
  return (
    <div className="grid grid-cols-[1fr_96px] gap-2">
      <div>
        <label className="label" htmlFor="city">Cidade *</label>
        <input id="city" className="input" value={city} onChange={(e) => onChange(e.target.value, uf)} placeholder="Ex.: Salvador" autoComplete="address-level2" />
        {errors?.city && <p className="field-error">{errors.city}</p>}
      </div>
      <div>
        <label className="label" htmlFor="uf">UF *</label>
        <select id="uf" className="input" value={uf} onChange={(e) => onChange(city, e.target.value)}>
          <option value="">--</option>
          {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        {errors?.uf && <p className="field-error">{errors.uf}</p>}
      </div>
    </div>
  );
}
