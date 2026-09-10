import { Spin } from 'antd';

/** Full-screen spinner shown while the auth session is being restored on startup. */
export default function AuthSessionLoader() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        width: '100%',
        background: '#f8fafc',
      }}
    >
      <Spin size="large" />
    </div>
  );
}
