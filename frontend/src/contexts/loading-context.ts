import { createContext, useContext } from 'react';

export interface LoadingContextType {
  isLoading: boolean;
  loadingMessage: string;
  setLoading: (loading: boolean, message?: string) => void;
}

/**
 * The context and its hook live apart from the provider component so that
 * LoadingContext.tsx exports a component and nothing else — Fast Refresh
 * cannot hot-swap a module that mixes components with other exports.
 */
export const LoadingContext = createContext<LoadingContextType | undefined>(
  undefined,
);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
};
