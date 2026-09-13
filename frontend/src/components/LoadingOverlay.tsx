import React from 'react';
import { Spin } from 'antd';
import { useLoading } from '../contexts/loading-context';

const LoadingOverlay: React.FC = () => {
  const { isLoading, loadingMessage } = useLoading();

  if (!isLoading) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(2px)',
    }}>
      <Spin size="large" />
      {loadingMessage && (
        <div style={{
          marginTop: 16,
          fontSize: '16px',
          color: '#666',
          textAlign: 'center',
          maxWidth: '300px',
        }}>
          {loadingMessage}
        </div>
      )}
    </div>
  );
};

export default LoadingOverlay;
