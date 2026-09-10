import { useState } from 'react';
import { Input, Select, Switch, Button } from 'antd';
import { EnvironmentOutlined, LoadingOutlined } from '@ant-design/icons';
import LocationMapPicker from './LocationMapPicker';
import {
  DEFAULT_COUNTRY_CODE,
  DOHA_CENTER,
  QATAR_ZONES,
} from '../../constants/qatar';

export type SpaceLocationValues = {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  map_lat?: string;
  map_lng?: string;
  transportation_notes?: string;
  is_published?: boolean;
};

type Props = {
  values: SpaceLocationValues;
  onChange: (patch: Partial<SpaceLocationValues>) => void;
  showPublishToggle?: boolean;
};

const ZONE_OPTIONS = QATAR_ZONES.map((z) => ({ value: z, label: z }));

export default function SpaceLocationFields({ values, onChange, showPublishToggle = true }: Props) {
  const [geocoding, setGeocoding] = useState(false);

  const geocode = async () => {
    const q = [values.address, values.city, 'Qatar']
      .filter(Boolean)
      .join(', ');
    if (!q.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } },
      );
      const data = await res.json();
      if (data?.[0]) {
        onChange({
          map_lat: String(parseFloat(data[0].lat)),
          map_lng: String(parseFloat(data[0].lon)),
          country: DEFAULT_COUNTRY_CODE,
        });
      }
    } finally {
      setGeocoding(false);
    }
  };

  const setCoordinates = (lat: number, lng: number) => {
    onChange({ map_lat: String(lat), map_lng: String(lng), country: DEFAULT_COUNTRY_CODE });
  };

  const hasCoords = values.map_lat && values.map_lng;

  return (
    <div style={{ border: '2px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        📍 Location Details (public map)
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Street Address</label>
        <Input value={values.address ?? ''} onChange={(e) => onChange({ address: e.target.value })} placeholder="e.g. Tornado Tower, West Bay" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Zone / District</label>
          <Select
            showSearch
            allowClear
            style={{ width: '100%' }}
            placeholder="Select zone"
            value={values.city || undefined}
            onChange={(v) => onChange({ city: v ?? '', country: DEFAULT_COUNTRY_CODE })}
            options={ZONE_OPTIONS}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Country</label>
          <Input value="Qatar" disabled style={{ background: '#f8fafc' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Latitude</label>
          <Input
            type="number"
            step="any"
            value={values.map_lat ?? ''}
            onChange={(e) => onChange({ map_lat: e.target.value })}
            placeholder={String(DOHA_CENTER.lat)}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Longitude</label>
          <Input
            type="number"
            step="any"
            value={values.map_lng ?? ''}
            onChange={(e) => onChange({ map_lng: e.target.value })}
            placeholder={String(DOHA_CENTER.lng)}
          />
        </div>
        <Button onClick={geocode} disabled={geocoding} icon={geocoding ? <LoadingOutlined /> : <EnvironmentOutlined />}>
          Geocode
        </Button>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Map preview</label>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {hasCoords ? 'Drag the pin or click the map to adjust' : 'Click Geocode or click on the map to place a pin'}
          </span>
        </div>
        <LocationMapPicker
          lat={values.map_lat}
          lng={values.map_lng}
          onPick={setCoordinates}
          height={240}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Transportation & Accessibility</label>
        <Input.TextArea
          rows={3}
          value={values.transportation_notes ?? ''}
          onChange={(e) => onChange({ transportation_notes: e.target.value })}
          placeholder="Metro, parking, wheelchair access..."
        />
      </div>

      {showPublishToggle && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e40af' }}>Publish to public map</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Requires location + coordinates. Only AVAILABLE spaces show.</div>
          </div>
          <Switch checked={!!values.is_published} onChange={(v) => onChange({ is_published: v })} />
        </div>
      )}
    </div>
  );
}
