import React from 'react';
import { Skeleton } from 'antd';

interface LoadingSkeletonProps {
  type?: 'table' | 'card' | 'list' | 'form';
  rows?: number;
  avatar?: boolean;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  type = 'card', 
  rows = 3, 
  avatar = false 
}) => {
  const renderTableSkeleton = () => (
    <div>
      <Skeleton.Input style={{ width: 200, marginBottom: 16 }} active />
      <Skeleton active paragraph={{ rows: 5 }} />
    </div>
  );

  const renderCardSkeleton = () => (
    <div style={{ padding: 24 }}>
      <Skeleton.Input style={{ width: '60%', marginBottom: 16 }} active />
      <Skeleton.Input style={{ width: '40%', marginBottom: 24 }} active />
      <Skeleton active paragraph={{ rows: rows }} />
      <div style={{ marginTop: 16 }}>
        <Skeleton.Button active size="small" style={{ marginRight: 8 }} />
        <Skeleton.Button active size="small" />
      </div>
    </div>
  );

  const renderListSkeleton = () => (
    <div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
          {avatar && <Skeleton.Avatar active size="large" style={{ marginRight: 16 }} />}
          <div style={{ flex: 1 }}>
            <Skeleton.Input style={{ width: '70%', marginBottom: 8 }} active />
            <Skeleton.Input style={{ width: '50%' }} active />
          </div>
        </div>
      ))}
    </div>
  );

  const renderFormSkeleton = () => (
    <div style={{ padding: 24 }}>
      <Skeleton.Input style={{ width: '80%', marginBottom: 16 }} active />
      <Skeleton.Input style={{ width: '100%', marginBottom: 16 }} active />
      <Skeleton.Input style={{ width: '100%', marginBottom: 16 }} active />
      <Skeleton.Input style={{ width: '60%', marginBottom: 24 }} active />
      <Skeleton.Button active size="large" style={{ marginRight: 8 }} />
      <Skeleton.Button active size="large" />
    </div>
  );

  const renderSkeleton = () => {
    switch (type) {
      case 'table':
        return renderTableSkeleton();
      case 'card':
        return renderCardSkeleton();
      case 'list':
        return renderListSkeleton();
      case 'form':
        return renderFormSkeleton();
      default:
        return renderCardSkeleton();
    }
  };

  return <div>{renderSkeleton()}</div>;
};

export default LoadingSkeleton;
