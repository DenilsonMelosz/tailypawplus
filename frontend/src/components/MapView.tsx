import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Crosshair, Loader2, Maximize2, X } from "lucide-react";
import { BRASIL } from "../lib/geo";
import { currentPosition } from "../lib/format";
import { useToast } from "./Toast";

export const pin = (color: string, size = 30) =>
  L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M12 23s-8-7.6-8-13a8 8 0 1 1 16 0c0 5.4-8 13-8 13z" fill="${color}" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="10" r="3.2" fill="#fff"/></svg>`,
  });

export const COLORS = { perdido: "#DC2626", avistado: "#0F7F8C", scan: "#F97316" };
const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export interface MapPoint { id: string; lat: number; lng: number; color: string; approximate?: boolean; label?: string; onClick?: () => void }
type LatLng = [number, number];

/** Enquadra os pontos; sem pontos, vai para o centro da cidade escolhida. */
function Fit({ points, center }: { points: LatLng[]; center?: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
      if (points.length === 1) map.setView(points[0], 15);
      else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
      else if (center) map.setView(center, 12);
      else map.setView(BRASIL, 4);
    }, 60);
    return () => clearTimeout(t);
  }, [map, JSON.stringify(points), center?.[0], center?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Focus({ points, focusId }: { points: MapPoint[]; focusId?: string | null }) {
  const map = useMap();
  useEffect(() => {
    const p = points.find((x) => x.id === focusId);
    if (p) map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [focusId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Botoes sobre o mapa: expandir e "minha localizacao". */
function Controls({ onExpand, onLocated, locate }: { onExpand?: () => void; onLocated: (p: LatLng) => void; locate: boolean }) {
  const map = useMap();
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ref.current) { L.DomEvent.disableClickPropagation(ref.current); L.DomEvent.disableScrollPropagation(ref.current); } }, []);
  const go = async () => {
    setBusy(true);
    try {
      const p = await currentPosition();
      const ll: LatLng = [p.coords.latitude, p.coords.longitude];
      onLocated(ll);
      map.flyTo(ll, 16, { duration: 0.6 });
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };
  const base = "w-10 h-10 rounded-xl bg-white shadow-md border border-stone-200 flex items-center justify-center text-ink hover:bg-stone-50 cursor-pointer";
  return (
    <div ref={ref} className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 no-print">
      {onExpand && <button type="button" className={base} onClick={onExpand} aria-label="Abrir o mapa em tela cheia" title="Abrir em tela cheia"><Maximize2 className="w-5 h-5" /></button>}
      {locate && <button type="button" className={base} onClick={go} disabled={busy} aria-label="Ir para a minha localização" title="Minha localização">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crosshair className="w-5 h-5" />}</button>}
    </div>
  );
}

export function MapView({ points, height = 260, center, focusId, locate = true, title = "Mapa", fullscreen = false, children }: {
  points: MapPoint[]; height?: number | string; center?: LatLng | null; focusId?: string | null; locate?: boolean; title?: string; fullscreen?: boolean; children?: ReactNode;
}) {
  const [me, setMe] = useState<LatLng | null>(null);
  const [big, setBig] = useState(false);
  const ll = points.map((p) => [p.lat, p.lng] as LatLng);
  return (
    <>
      <MapContainer center={center ?? ll[0] ?? BRASIL} zoom={center || ll.length ? 12 : 4} style={{ height, width: "100%" }} className="rounded-2xl z-0" scrollWheelZoom={fullscreen}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url={TILES} />
        <Fit points={ll} center={center} />
        <Focus points={points} focusId={focusId} />
        <Controls locate={locate} onExpand={fullscreen ? undefined : () => setBig(true)} onLocated={setMe} />
        {me && (
          <>
            <Circle center={me} radius={40} pathOptions={{ color: "#2563EB", weight: 1, fillOpacity: 0.15 }} />
            <CircleMarker center={me} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#2563EB", fillOpacity: 1 }}><Popup>Você está aqui</Popup></CircleMarker>
          </>
        )}
        {points.map((p) => (
          <span key={p.id}>
            {p.approximate && <Circle center={[p.lat, p.lng]} radius={200} pathOptions={{ color: p.color, weight: 1, fillOpacity: 0.12, dashArray: "4 4" }} />}
            <Marker position={[p.lat, p.lng]} icon={pin(p.color)} eventHandlers={p.onClick ? { click: p.onClick } : undefined}>
              {p.label && !p.onClick && <Popup>{p.label}</Popup>}
            </Marker>
          </span>
        ))}
        {children}
      </MapContainer>
      {big && createPortal(
        <div className="fixed inset-0 z-[1700] bg-white flex flex-col no-print" role="dialog" aria-modal="true" aria-label={title}>
          <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-stone-200">
            <p className="font-extrabold">{title}</p>
            <button type="button" onClick={() => setBig(false)} className="btn-ghost h-10 px-4" aria-label="Fechar o mapa"><X className="w-4 h-4" />Fechar</button>
          </div>
          <div className="flex-1 min-h-0 p-2">
            <MapView points={points.map((p) => ({ ...p, onClick: p.onClick ? () => { setBig(false); p.onClick!(); } : undefined }))} height="100%" center={center} focusId={focusId} title={title} fullscreen />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Vai para o ponto marcado; sem ponto, para o centro da cidade. */
function Recenter({ pos, center }: { pos: LatLng | null; center?: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
      // um ponto marcado dentro da area visivel nao mexe no mapa (nada de pular o zoom a cada toque)
      if (pos) { if (!map.getBounds().contains(pos)) map.setView(pos, Math.max(map.getZoom(), 15)); }
      else if (center) map.setView(center, 13);
      else map.setView(BRASIL, 4);
    }, 60);
    return () => clearTimeout(t);
  }, [map, pos?.[0], pos?.[1], center?.[0], center?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function LocationPicker({ value, onChange, center }: { value: LatLng | null; onChange: (lat: number, lng: number) => void; center?: LatLng | null }) {
  const [big, setBig] = useState(false);
  const map = (h: number | string, full: boolean) => (
    <MapContainer center={value ?? center ?? BRASIL} zoom={value || center ? 14 : 4} style={{ height: h, width: "100%" }} className="rounded-2xl z-0" scrollWheelZoom={full}>
      <TileLayer attribution="&copy; OpenStreetMap" url={TILES} />
      <ClickToPick onPick={onChange} />
      <Recenter pos={value} center={center} />
      <Controls locate onExpand={full ? undefined : () => setBig(true)} onLocated={(p) => onChange(p[0], p[1])} />
      {value && <Marker position={value} icon={pin(COLORS.perdido, 34)} draggable eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng); } }} />}
    </MapContainer>
  );
  return (
    <>
      {map(260, false)}
      {big && createPortal(
        <div className="fixed inset-0 z-[1700] bg-white flex flex-col no-print" role="dialog" aria-modal="true" aria-label="Marcar o local no mapa">
          <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-stone-200">
            <p className="font-extrabold">Toque no mapa para marcar o local</p>
            <button type="button" onClick={() => setBig(false)} className="btn-primary h-10 px-4">{value ? "Confirmar local" : "Fechar"}</button>
          </div>
          <div className="flex-1 min-h-0 p-2">{map("100%", true)}</div>
        </div>,
        document.body,
      )}
    </>
  );
}
