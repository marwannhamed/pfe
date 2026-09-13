import { useState, useCallback, useRef } from 'react';
import { useLoading } from '../contexts/loading-context';
import { useToast } from '../contexts/toast-context';

interface UseApiWithLoadingOptions {
  showSuccessMessage?: boolean;
  successMessage?: string;
  loadingMessage?: string;
  showErrorToast?: boolean;
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export const useApiWithLoading = <T = any>(options: UseApiWithLoadingOptions = {}) => {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const { setLoading } = useLoading();
  const { showSuccess, showError } = useToast();

  // ─── FIX: store options and context fns in refs ────────────────────────────
  // Context functions (setLoading, showSuccess, showError) are often recreated
  // on every render depending on how the context is implemented. If `execute`
  // lists them as useCallback deps, its reference changes every render.
  // Any component that then puts `execute` in a useEffect dep array will
  // re-fire that effect every render → repeated API calls → 429s.
  // Storing them in refs breaks that chain while keeping the live values.
  const setLoadingRef = useRef(setLoading);
  const showSuccessRef = useRef(showSuccess);
  const showErrorRef = useRef(showError);
  const optionsRef = useRef(options);

  // Keep refs in sync without causing re-renders
  setLoadingRef.current = setLoading;
  showSuccessRef.current = showSuccess;
  showErrorRef.current = showError;
  optionsRef.current = options;

  // ─── execute is now permanently stable (empty dep array) ──────────────────
  const execute = useCallback(async (
    apiCall: () => Promise<T>,
    customLoadingMessage?: string
  ): Promise<T | null> => {
    const {
      showSuccessMessage = true,
      successMessage,
      loadingMessage = 'Loading...',
      showErrorToast = true,
    } = optionsRef.current;

    setState(prev => ({ ...prev, loading: true, error: null }));
    setLoadingRef.current(true, customLoadingMessage ?? loadingMessage);

    try {
      const result = await apiCall();
      setState({ data: result, loading: false, error: null });

      if (showSuccessMessage && successMessage) {
        showSuccessRef.current(successMessage);
      }

      return result;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.message || 'An error occurred';

      setState(prev => ({ ...prev, loading: false, error: errorMessage }));

      if (showErrorToast) {
        showErrorRef.current('Request Failed', errorMessage);
      }

      return null;
    } finally {
      setLoadingRef.current(false);
    }
  }, []); // ✅ stable forever — reads live values via refs

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
};

// ─── Convenience hooks ────────────────────────────────────────────────────────

export const useApiCall = () => {
  const { execute } = useApiWithLoading({ showSuccessMessage: false });
  return { execute };
};

export const useApiMutation = <T = any>(
  apiCall: (data: any) => Promise<T>,
  options: UseApiWithLoadingOptions & { onSuccess?: (data: T) => void } = {}
) => {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const { setLoading } = useLoading();
  const { showSuccess, showError } = useToast();

  // ─── FIX: same ref pattern for mutation ───────────────────────────────────
  const setLoadingRef = useRef(setLoading);
  const showSuccessRef = useRef(showSuccess);
  const showErrorRef = useRef(showError);
  const apiCallRef = useRef(apiCall);
  const optionsRef = useRef(options);

  setLoadingRef.current = setLoading;
  showSuccessRef.current = showSuccess;
  showErrorRef.current = showError;
  apiCallRef.current = apiCall;
  optionsRef.current = options;

  // ─── mutate is permanently stable ─────────────────────────────────────────
  const mutate = useCallback(async (data: any): Promise<T | null> => {
    const {
      loadingMessage = 'Processing...',
      showSuccessMessage = true,
      successMessage = 'Operation completed successfully',
      showErrorToast = true,
      onSuccess,
    } = optionsRef.current;

    setState(prev => ({ ...prev, loading: true, error: null }));
    setLoadingRef.current(true, loadingMessage);

    try {
      const result = await apiCallRef.current(data);
      setState({ data: result, loading: false, error: null });

      if (showSuccessMessage) {
        showSuccessRef.current(successMessage);
      }

      onSuccess?.(result);
      return result;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.message || 'An error occurred';

      setState(prev => ({ ...prev, loading: false, error: errorMessage }));

      if (showErrorToast) {
        showErrorRef.current('Operation Failed', errorMessage);
      }

      return null;
    } finally {
      setLoadingRef.current(false);
    }
  }, []); // ✅ stable forever

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, mutate, reset };
};