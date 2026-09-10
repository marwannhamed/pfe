import { useState, useRef } from 'react';
import { Spin } from 'antd';
import { message } from '../utils/feedback';
import { PlusOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { uploadApi } from '../api/services';
import { useThemeStore } from '../store/themeStore';

interface Props {
  spaceId: string;
  photos: string[];           // existing photo URLs from DB
  onUpdate: (photos: string[]) => void;  // called after upload/delete
  readonly?: boolean;
}

export default function SpacePhotoGallery({ spaceId, photos = [], onUpdate, readonly = false }: Props) {
  const { t } = useThemeStore();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    // Validate — images only, max 10MB each
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        message.error(`${file.name} is not an image`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        message.error(`${file.name} is too large (max 10MB)`);
        return;
      }
    }

    setUploading(true);
    try {
      const res = await uploadApi.uploadSpacePhotos(spaceId, files);
      const newPhotos: string[] = res.data.photos;
      onUpdate([...photos, ...newPhotos]);
      message.success(`${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''} uploaded!`);
    } catch {
      message.error('Upload failed — please try again');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (url: string) => {
    setDeletingUrl(url);
    try {
      const res = await uploadApi.deleteSpacePhoto(spaceId, url);
      onUpdate(res.data.photos);
      message.success('Photo deleted');
    } catch {
      message.error('Delete failed');
    } finally {
      setDeletingUrl(null);
    }
  };

  return (
    <div>
      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>

        {/* Existing photos */}
        {photos.map((url, i) => (
          <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '4/3', background: t.tableHead, border: `1px solid ${t.cardBorder}` }}>
            <img
              src={url}
              alt={`Space photo ${i + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Hover overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.45)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}>
              <button onClick={() => setPreview(url)}
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
                <EyeOutlined style={{ fontSize: 14 }} />
              </button>
              {!readonly && (
                <button onClick={() => handleDelete(url)} disabled={deletingUrl === url}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  {deletingUrl === url ? <Spin size="small" /> : <DeleteOutlined style={{ fontSize: 14 }} />}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Upload button */}
        {!readonly && photos.length < 10 && (
          <div
            onClick={() => !uploading && inputRef.current?.click()}
            style={{ aspectRatio: '4/3', borderRadius: 10, border: `2px dashed ${t.cardBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: uploading ? 'not-allowed' : 'pointer', background: t.tableHead, transition: 'border-color 0.15s' }}
            onMouseEnter={e => !uploading && (e.currentTarget.style.borderColor = '#2563eb')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = t.cardBorder)}>
            {uploading ? (
              <Spin />
            ) : (
              <>
                <PlusOutlined style={{ fontSize: 22, color: t.textMuted }} />
                <span style={{ fontSize: 11, color: t.textMuted }}>Add photos</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Count */}
      <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted }}>
        {photos.length} / 10 photos
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Lightbox preview */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'pointer' }}>
          <img
            src={preview}
            alt="Preview"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <button onClick={() => setPreview(null)}
            style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}