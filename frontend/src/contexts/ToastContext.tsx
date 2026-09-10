import React, { createContext, useContext, ReactNode } from 'react';
import { App } from 'antd';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, description?: string, duration?: number) => void;
  showSuccess: (title: string, description?: string) => void;
  showError: (title: string, description?: string) => void;
  showWarning: (title: string, description?: string) => void;
  showInfo: (title: string, description?: string) => void;
  showLoading: (title: string, description?: string) => () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const { message, notification } = App.useApp();

  const showToast = (type: ToastType, title: string, description?: string, duration = 4.5) => {
    notification[type]({
      title,
      description,
      duration,
      placement: 'topRight',
      style: {
        marginTop: 48, // Account for header
      },
    });
  };

  const showSuccess = (title: string, description?: string) => {
    showToast('success', title, description);
  };

  const showError = (title: string, description?: string) => {
    showToast('error', title, description, 0); // Don't auto-close errors
  };

  const showWarning = (title: string, description?: string) => {
    showToast('warning', title, description);
  };

  const showInfo = (title: string, description?: string) => {
    showToast('info', title, description);
  };

  const showLoading = (title: string, description?: string) => {
    const hide = message.loading(title, 0);
    return hide;
  };

  return (
    <ToastContext.Provider value={{
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showLoading,
    }}>
      {children}
    </ToastContext.Provider>
  );
};
