import { api } from './client';
import { 
  AddOnService, 
  PromotionCode, 
  ContractItem, 
  Deposit, 
  InvoiceLine,
  BookingAddOn,
  SpaceFeature,
  Report,
  EmailTestRequest,
  AnalyticsOverview,
  RevenueTrend,
  BookingStatusData,
  SpaceUtilization,
  MaintenanceStats,
  TopSpace,
  RevenueByTenant
} from '../types';

// ─── Enhanced Error Handling ─────────────────────────────────────────────────────
class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

const handleAPIError = (error: any) => {
  if (error.response) {
    const { status, data } = error.response;
    throw new APIError(
      data.message || 'API request failed',
      status,
      data.code,
      data
    );
  } else if (error.request) {
    throw new APIError('Network error - please check your connection');
  } else {
    throw new APIError(error.message || 'An unexpected error occurred');
  }
};

// ─── Enhanced AddOn Services API ─────────────────────────────────────────────────
export const enhancedAddonServiceApi = {
  getAll: async (siteId?: string) => {
    try {
      const response = await api.get('/addon-services', { 
        params: siteId ? { siteId } : {} 
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getOne: async (id: string) => {
    try {
      const response = await api.get(`/addon-services/${id}`);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  create: async (data: Partial<AddOnService>) => {
    try {
      const response = await api.post('/addon-services', data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  update: async (id: string, data: Partial<AddOnService>) => {
    try {
      const response = await api.patch(`/addon-services/${id}`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  remove: async (id: string) => {
    try {
      await api.delete(`/addon-services/${id}`);
      return { success: true };
    } catch (error) {
      handleAPIError(error);
    }
  },

  // Additional methods
  getActiveServices: async (siteId?: string) => {
    try {
      const response = await api.get('/addon-services/active', { 
        params: siteId ? { siteId } : {} 
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getServicesByCategory: async (category: string, siteId?: string) => {
    try {
      const response = await api.get('/addon-services/by-category', { 
        params: { category, ...(siteId && { siteId }) }
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },
};

// ─── Enhanced Promotion Codes API ─────────────────────────────────────────────────
export const enhancedPromotionCodeApi = {
  getAll: async (siteId?: string) => {
    try {
      const response = await api.get('/promotion-codes', { 
        params: siteId ? { siteId } : {} 
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getOne: async (id: string) => {
    try {
      const response = await api.get(`/promotion-codes/${id}`);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  create: async (data: Partial<PromotionCode>) => {
    try {
      const response = await api.post('/promotion-codes', data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  update: async (id: string, data: Partial<PromotionCode>) => {
    try {
      const response = await api.patch(`/promotion-codes/${id}`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  remove: async (id: string) => {
    try {
      await api.delete(`/promotion-codes/${id}`);
      return { success: true };
    } catch (error) {
      handleAPIError(error);
    }
  },

  validate: async (code: string, siteId?: string, bookingAmount?: number) => {
    try {
      const response = await api.post('/promotion-codes/validate', { 
        code, 
        siteId, 
        bookingAmount 
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  // Additional methods
  getActiveCodes: async (siteId?: string) => {
    try {
      const response = await api.get('/promotion-codes/active', { 
        params: siteId ? { siteId } : {} 
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getUsageStats: async (codeId: string) => {
    try {
      const response = await api.get(`/promotion-codes/${codeId}/usage-stats`);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },
};

// ─── Enhanced Contract Items API ───────────────────────────────────────────────────
export const enhancedContractItemApi = {
  getByContract: async (contractId: string) => {
    try {
      const response = await api.get(`/lease-contracts/${contractId}/items`);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  create: async (contractId: string, data: Partial<ContractItem>) => {
    try {
      const response = await api.post(`/lease-contracts/${contractId}/items`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  update: async (contractId: string, itemId: string, data: Partial<ContractItem>) => {
    try {
      const response = await api.patch(`/lease-contracts/${contractId}/items/${itemId}`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  remove: async (contractId: string, itemId: string) => {
    try {
      await api.delete(`/lease-contracts/${contractId}/items/${itemId}`);
      return { success: true };
    } catch (error) {
      handleAPIError(error);
    }
  },
};

// ─── Enhanced Deposits API ───────────────────────────────────────────────────────
export const enhancedDepositApi = {
  getByContract: async (contractId: string) => {
    try {
      const response = await api.get(`/lease-contracts/${contractId}/deposit`);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  create: async (contractId: string, data: Partial<Deposit>) => {
    try {
      const response = await api.post(`/lease-contracts/${contractId}/deposit`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  refund: async (contractId: string, data: { amount: string; notes?: string }) => {
    try {
      const response = await api.patch(`/lease-contracts/${contractId}/deposit/refund`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getRefundHistory: async (contractId: string) => {
    try {
      const response = await api.get(`/lease-contracts/${contractId}/deposit/refunds`);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },
};

// ─── Enhanced Invoice Lines API ───────────────────────────────────────────────────
export const enhancedInvoiceLineApi = {
  getByInvoice: async (invoiceId: string) => {
    try {
      const response = await api.get(`/billing/invoices/${invoiceId}/lines`);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  create: async (invoiceId: string, data: Partial<InvoiceLine>) => {
    try {
      const response = await api.post(`/billing/invoices/${invoiceId}/lines`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  update: async (invoiceId: string, lineId: string, data: Partial<InvoiceLine>) => {
    try {
      const response = await api.patch(`/billing/invoices/${invoiceId}/lines/${lineId}`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  remove: async (invoiceId: string, lineId: string) => {
    try {
      await api.delete(`/billing/invoices/${invoiceId}/lines/${lineId}`);
      return { success: true };
    } catch (error) {
      handleAPIError(error);
    }
  },

  recalculateTotal: async (invoiceId: string) => {
    try {
      const response = await api.post(`/billing/invoices/${invoiceId}/recalculate`);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },
};

// ─── Enhanced Booking AddOns API ─────────────────────────────────────────────────
export const enhancedBookingAddOnApi = {
  getByBooking: async (bookingId: string) => {
    try {
      const response = await api.get(`/bookings/${bookingId}/addons`);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  create: async (bookingId: string, data: Partial<BookingAddOn>) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/addons`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  remove: async (bookingId: string, addonId: string) => {
    try {
      await api.delete(`/bookings/${bookingId}/addons/${addonId}`);
      return { success: true };
    } catch (error) {
      handleAPIError(error);
    }
  },

  updateQuantity: async (bookingId: string, addonId: string, quantity: number) => {
    try {
      const response = await api.patch(`/bookings/${bookingId}/addons/${addonId}`, { quantity });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },
};

// ─── Enhanced Space Features API ─────────────────────────────────────────────────
export const enhancedSpaceFeatureApi = {
  getBySpace: async (spaceId: string) => {
    try {
      const response = await api.get(`/spaces/${spaceId}/features`);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  create: async (spaceId: string, data: Partial<SpaceFeature>) => {
    try {
      const response = await api.post(`/spaces/${spaceId}/features`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  update: async (spaceId: string, featureId: string, data: Partial<SpaceFeature>) => {
    try {
      const response = await api.patch(`/spaces/${spaceId}/features/${featureId}`, data);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  remove: async (spaceId: string, featureId: string) => {
    try {
      await api.delete(`/spaces/${spaceId}/features/${featureId}`);
      return { success: true };
    } catch (error) {
      handleAPIError(error);
    }
  },

  toggleAvailability: async (spaceId: string, featureId: string, isAvailable: boolean) => {
    try {
      const response = await api.patch(`/spaces/${spaceId}/features/${featureId}/availability`, { isAvailable });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },
};

// ─── Enhanced Reports API ───────────────────────────────────────────────────────
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

export const enhancedReportApi = {
  getAll: async (params?: { type?: string; format?: string; dateFrom?: string; dateTo?: string }) => {
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
    parameters?: Record<string, any>;
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
      const response = await api.get(`/reports/${id}/download`, { responseType: 'blob' });
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

// ─── Enhanced Analytics API ─────────────────────────────────────────────────────
export const enhancedAnalyticsApi = {
  getOverview: async (from: string, to: string, tenantId?: string) => {
    try {
      const response = await api.get('/analytics/overview', { 
        params: { from, to, ...(tenantId && { tenantId }) }
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getRevenueTrend: async (from: string, to: string, tenantId?: string) => {
    try {
      const response = await api.get('/analytics/revenue-trend', { 
        params: { from, to, ...(tenantId && { tenantId }) }
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getBookingsTrend: async (from: string, to: string, tenantId?: string) => {
    try {
      const response = await api.get('/analytics/bookings-trend', { 
        params: { from, to, ...(tenantId && { tenantId }) }
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getBookingStatus: async (from: string, to: string, tenantId?: string) => {
    try {
      const response = await api.get('/analytics/bookings-by-status', { 
        params: { from, to, ...(tenantId && { tenantId }) }
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getSpaceUtil: async () => {
    try {
      const response = await api.get('/analytics/space-utilization');
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getMaintenance: async (from: string, to: string) => {
    try {
      const response = await api.get('/analytics/maintenance', { 
        params: { from, to }
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getTopSpaces: async (from: string, to: string) => {
    try {
      const response = await api.get('/analytics/top-spaces', { 
        params: { from, to }
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getRevenueByTenant: async (from: string, to: string) => {
    try {
      const response = await api.get('/analytics/revenue-by-tenant', { 
        params: { from, to }
      });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  // Additional analytics methods
  getCustomReport: async (config: { metrics: string[]; dimensions: string[]; filters: Record<string, any> }) => {
    try {
      const response = await api.post('/analytics/custom', config);
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  getRealTimeMetrics: async () => {
    try {
      const response = await api.get('/analytics/real-time');
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },
};

// ─── Enhanced Email API ─────────────────────────────────────────────────────────
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

  // Additional email methods
  getTemplates: async () => {
    try {
      const response = await api.get('/mail/templates');
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  previewTemplate: async (templateName: string, data: Record<string, any>) => {
    try {
      const response = await api.post('/mail/preview', { template: templateName, data });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },

  sendBulkEmail: async (templateName: string, recipients: string[], data: Record<string, any>) => {
    try {
      const response = await api.post('/mail/bulk', { template: templateName, recipients, data });
      return response.data;
    } catch (error) {
      handleAPIError(error);
    }
  },
};

export { APIError };
