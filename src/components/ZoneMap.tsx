// Carte Leaflet / OpenStreetMap — chargée uniquement côté navigateur (React.lazy).
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoZone, LatLng } from "@/lib/geo";

type Marker = { id: string; at: LatLng; label: string };
type Props = {
  center: LatLng;
  zones?: GeoZone[];
  selectedId?: string | null;
  draft?: LatLng[];
  markers?: Marker[];
  onMapClick?: (p: LatLng) => void;
  className?: string;
};

const dot = (color: string) => L.divIcon({ className: "", html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`, iconSize: [16, 16], iconAnchor: [8, 8] });

export default function ZoneMap({ center, zones = [], selectedId, draft, markers = [], onMapClick, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView(center, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => clickRef.current?.([e.latlng.lat, e.latlng.lng]));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = layer.current, m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    L.marker(center, { icon: dot("#222029"), title: "Restaurant" }).addTo(g);
    const bounds: L.LatLngExpression[] = [center];
    for (const z of zones) {
      const sel = z.id === selectedId;
      const style = { color: sel ? "#007af5" : "#64748b", weight: sel ? 3 : 2, fillOpacity: sel ? 0.25 : 0.1 };
      if (z.type === "circle" && z.center && z.radiusKm) { L.circle(z.center, { ...style, radius: z.radiusKm * 1000 }).bindTooltip(z.name).addTo(g); bounds.push(z.center); }
      if (z.type === "polygon" && z.points?.length) {
        (z.points.length >= 3 ? L.polygon(z.points, style) : L.polyline(z.points, style)).bindTooltip(z.name).addTo(g);
        if (sel) z.points.forEach((p) => L.circleMarker(p, { radius: 4, color: "#007af5" }).addTo(g));
        bounds.push(...z.points);
      }
    }
    if (draft?.length) { L.polyline(draft, { color: "#007af5", dashArray: "4 4" }).addTo(g); draft.forEach((p) => L.circleMarker(p, { radius: 5, color: "#007af5" }).addTo(g)); }
    for (const mk of markers) { L.marker(mk.at, { icon: dot("#e11d48") }).bindTooltip(mk.label).addTo(g); bounds.push(mk.at); }
  }, [center, zones, selectedId, draft, markers]);

  useEffect(() => {
    if (map.current && markers.length) map.current.fitBounds(L.latLngBounds([center, ...markers.map((m) => m.at)]), { padding: [30, 30], maxZoom: 15 });
  }, [markers, center]);

  return <div ref={el} className={className ?? "h-[420px] w-full rounded-xl border border-border"} role="application" aria-label="Carte interactive" />;
}
