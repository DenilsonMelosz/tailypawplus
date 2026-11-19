import { useEffect } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, Popup, useMap, useMapEvents } from "react-leaflet";
import { SALVADOR } from "../lib/format";

export const pin = (color: string, size = 30) =>
  L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M12 23s-8-7.6-8-13a8 8 0 1 1 16 0c0 5.4-8 13-8 13z" fill="${color}" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="10" r="3.2" fill="#fff"/></svg>`,
  });

export const COLORS = { perdido: "#DC2626", avistado: "#0F7F8C", scan: "#F97316" };

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    // Leaflet em container que muda de tamanho precisa recalcular
    setTimeout(() => map.invalidateSize(), 50);
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
  }, [map, JSON.stringify(points)]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export interface MapPoint { id: string; lat: number; lng: number; color: string; approximate?: boolean; label?: string; onClick?: () => void }

export function MapView({ points, height = 260, center }: { points: MapPoint[]; height?: number; center?: [number, number] }) {
  return (
    <MapContainer center={center ?? SALVADOR} zoom={12} style={{ height, width: "100%" }} className="rounded-2xl z-0" scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit points={points.map((p) => [p.lat, p.lng])} />
      {points.map((p) => (
        <span key={p.id}>
          {p.approximate && <Circle center={[p.lat, p.lng]} radius={200} pathOptions={{ color: p.color, weight: 1, fillOpacity: 0.12, dashArray: "4 4" }} />}
          <Marker position={[p.lat, p.lng]} icon={pin(p.color)} eventHandlers={p.onClick ? { click: p.onClick } : undefined}>
            {p.label && !p.onClick && <Popup>{p.label}</Popup>}
          </Marker>
        </span>
      ))}
    </MapContainer>
  );
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 50); if (pos) map.setView(pos, Math.max(map.getZoom(), 15)); }, [map, pos?.[0], pos?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function LocationPicker({ value, onChange }: { value: [number, number] | null; onChange: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={value ?? SALVADOR} zoom={13} style={{ height: 240, width: "100%" }} className="rounded-2xl z-0">
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToPick onPick={onChange} />
      <Recenter pos={value} />
      {value && <Marker position={value} icon={pin(COLORS.perdido, 34)} draggable eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng); } }} />}
    </MapContainer>
  );
}
