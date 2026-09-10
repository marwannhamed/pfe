import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

import { DOHA_CENTER } from '../../constants/qatar';

const DEFAULT_CENTER: [number, number] = [DOHA_CENTER.lat, DOHA_CENTER.lng];

function MapFlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type Props = {
  lat?: string;
  lng?: string;
  onPick: (lat: number, lng: number) => void;
  height?: number;
};

export default function LocationMapPicker({ lat, lng, onPick, height = 220 }: Props) {
  const parsed = useMemo(() => {
    const la = parseFloat(lat ?? '');
    const ln = parseFloat(lng ?? '');
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
    return { lat: la, lng: ln };
  }, [lat, lng]);

  const center: [number, number] = parsed ? [parsed.lat, parsed.lng] : DEFAULT_CENTER;
  const zoom = parsed ? 15 : 11;

  const handlePick = (la: number, ln: number) => {
    onPick(
      Math.round(la * 1_000_000) / 1_000_000,
      Math.round(ln * 1_000_000) / 1_000_000,
    );
  };

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height, width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPick={handlePick} />
        {parsed && (
          <>
            <MapFlyTo lat={parsed.lat} lng={parsed.lng} />
            <Marker
              position={[parsed.lat, parsed.lng]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  handlePick(pos.lat, pos.lng);
                },
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
