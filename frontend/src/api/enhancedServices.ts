import { api } from './client';
import type { ApiError, EmailTestRequest } from '../types';

/**
 * Report and email endpoints that surface errors to the caller as a typed
 * APIError rather than a raw axios rejection.
 *
 * Everything else lives in `services.ts`. This file previously mirrored eight
 * more resources, but none of them were imported anywhere and several pointed
 * at endpoints that no longer exist.
 */

// ─── Error handling ──────────────────────────────────────────────────────────
class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public response?: any,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

const handleAPIError = (error: ApiError) => {
  if (error.response) {
    const { status, data } = error.response;
    const raw = data?.message;
    throw new APIError(
      (Array.isArray(raw) ? raw[0] : raw) || 'API request failed',
      status,
      error.code,
      data,
    );
  } else if (error.request) {
    throw new APIError('Network error - please check your connection');
  } else {
    throw new APIError(error.message || 'An unexpected error occurred');
  }
};

// ─── Response unwrapping ─────────────────────────────────────────────────────
function unwrapList(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const body = raw as { data?: unknown };
  if (Array.isArray(body.data)) return body.data;
  return [];
}

function unwrapOne<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in (raw as object)) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export const enhancedReportApi = {
  getAll: async (params?: {
    type?: string;
    format?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    try {
      const response = await api.get('/reports', { params });
      return unwrapList(response.data);
    } catch (error) {
      handleAPIError(error);
    }
  },

  getOne: async (id: string) => {
    try {
      const response = await api.get(`/reports/${id}`);
      return unwrapOne(response.data);
    } catch (error) {
      handleAPIError(error);
    }
  },

  generate: async (data: {
    type: string;
    title?: string;
    parameters?: Record<string, unknown>;
    format: string;
  }) => {
    try {
      const response = await api.post('/reports/generate', data);
      return unwrapOne(response.data);
    } catch (error) {
      handleAPIError(error);
    }
  },

  download: async (id: string) => {
    try {
      const response = await api.get(`/reports/${id}/download`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  remove: async (id: string) => {
    try {
      await api.delete(`/reports/${id}`);
      return { success: true };
    } catch (error) {
      handleAPIError(error);
    }
  },

  getTemplates: async () => {
    try {
      const response = await api.get('/reports/templates');
      return unwrapList(response.data);
    } catch (error) {
      handleAPIError(error);
    }
  },
};

// ─── Transactional email test harness ────────────────────────────────────────
export const enhancedEmailApi = {
  testBookingConfirmed: async (data: EmailTestRequest) => {
    try {
      const response = await api.post('/mail/test/booking-confirmed', data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  testInvoiceCreated: async (data: EmailTestRequest) => {
    try {
      const response = await api.post('/mail/test/invoice-created', data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  testInvoiceOverdue: async (data: EmailTestRequest) => {
    try {
      const response = await api.post('/mail/test/invoice-overdue', data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  testContractExpiring: async (data: EmailTestRequest) => {
    try {
      const response = await api.post('/mail/test/contract-expiring', data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  testMaintenanceCreated: async (data: EmailTestRequest) => {
    try {
      const response = await api.post('/mail/test/maintenance-created', data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  testWelcome: async (data: EmailTestRequest) => {
    try {
      const response = await api.post('/mail/test/welcome', data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getTemplates: async () => {
    try {
      const response = await api.get('/mail/templates');
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  previewTemplate: async (templateName: string, data: Record<string, unknown>) => {
    try {
      const response = await api.post('/mail/preview', {
        template: templateName,
        data,
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  sendBulkEmail: async (
    templateName: string,
    recipients: string[],
    data: Record<string, unknown>,
  ) => {
    try {
      const response = await api.post('/mail/bulk', {
        template: templateName,
        recipients,
        data,
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },
};

export { APIError };
