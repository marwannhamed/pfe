import { useRef } from 'react';
import { DeleteOutlined, PictureOutlined, GlobalOutlined } from '@ant-design/icons';

const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };
const INPUT: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#0f172a', outline: 'none', background: '#fff', boxSizing: 'border-box' };

export type SpaceMediaValues = {
  photoFiles: File[];
  virtual_tour_url: string;
};

type Props = {
  values: SpaceMediaValues;
  onChange: (patch: Partial<SpaceMediaValues>) => void;
};

export default function SpaceMediaFields({ values, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...values.photoFiles, ...Array.from(files)].slice(0, 12);
    onChange({ photoFiles: next });
  };

  const removePhoto = (index: number) => {
    onChange({ photoFiles: values.photoFiles.filter((_, i) => i !== index) });
  };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Photos & 3D tour
      </div>

      <label style={LABEL}>Space photos</label>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: '#64748b' }}>
        Upload up to 12 images — shown on the public map when guests browse spaces.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        {values.photoFiles.map((file, i) => (
          <div key={`${file.name}-${i}`} style={{ position: 'relative', width: 88, height: 88 }}>
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <button
              type="button"
              onClick={() => removePhoto(i)}
              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(15,23,42,0.75)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <DeleteOutlined style={{ fontSize: 11 }} />
            </button>
          </div>
        ))}
        {values.photoFiles.length < 12 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{ width: 88, height: 88, borderRadius: 8, border: '2px dashed #cbd5e1', background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#64748b' }}
          >
            <PictureOutlined style={{ fontSize: 18 }} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>Add</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />

      <label style={{ ...LABEL, marginTop: 4 }}>
        <GlobalOutlined style={{ marginRight: 6 }} />
        3D virtual tour URL (optional)
      </label>
      <p style={{ margin: '0 0 8px', fontSize: 11, color: '#64748b' }}>
        Paste a Matterport, Sketchfab, or similar embed link — guests can explore the space in 3D.
      </p>
      <input
        style={INPUT}
        placeholder="https://my.matterport.com/show/?m=..."
        value={values.virtual_tour_url}
        onChange={(e) => onChange({ virtual_tour_url: e.target.value })}
      />
    </div>
  );
}
