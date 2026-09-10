import { useState, useRef, useEffect } from 'react';
import { Spin } from 'antd';
import { message } from '../utils/feedback';
import { CameraOutlined } from '@ant-design/icons';
import { uploadApi } from '../api/services';
import { useThemeStore } from '../store/themeStore';

interface Props {
  userId: string;
  currentAvatarUrl?: string;
  firstName?: string;
  lastName?: string;
  size?: number;
  onUpdate?: (url: string) => void;
}

export default function AvatarUpload({
  userId,
  currentAvatarUrl,
  firstName = '',
  lastName = '',
  size = 80,
  onUpdate,
}: Props) {
  const { t } = useThemeStore();
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarUrl(currentAvatarUrl);
  }, [currentAvatarUrl]);

  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      message.error('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('Image too large (max 5MB)');
      return;
    }

    setUploading(true);
    try {
      const res = await uploadApi.uploadAvatar(userId, file);
      const payload = res.data as { url?: string; avatar_url?: string; data?: { url?: string } };
      const url: string =
        payload?.url ??
        payload?.avatar_url ??
        payload?.data?.url ??
        '';
      if (!url) throw new Error('No URL in upload response');
      const displayUrl = url.includes('?') ? `${url}&v=${Date.now()}` : `${url}?v=${Date.now()}`;
      setAvatarUrl(displayUrl);
      onUpdate?.(url);
      message.success('Profile photo updated!');
    } catch {
      message.error('Upload failed — please try again');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Avatar circle */}
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `3px solid ${t.cardBg}`, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer', position: 'relative' }}
        onClick={() => !uploading && inputRef.current?.click()}>
        {uploading ? (
          <Spin size={size > 60 ? 'default' : 'small'} />
        ) : avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: size * 0.35, fontWeight: 700, color: '#fff' }}>{initials}</span>
        )}

        {/* Camera overlay on hover */}
        {!uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', borderRadius: '50%' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}>
            <CameraOutlined style={{ color: '#fff', fontSize: size * 0.25, opacity: 0 }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0')} />
          </div>
        )}
      </div>

      {/* Edit badge */}
      <div onClick={() => !uploading && inputRef.current?.click()}
        style={{ position: 'absolute', bottom: 0, right: 0, width: Math.max(size * 0.3, 24), height: Math.max(size * 0.3, 24), borderRadius: '50%', background: '#2563eb', border: `2px solid ${t.cardBg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <CameraOutlined style={{ color: '#fff', fontSize: Math.max(size * 0.14, 10) }} />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={uploading}
      />
    </div>
  );
}