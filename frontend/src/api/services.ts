import { api, listFromApi } from './client';
import type { Building, Floor, Space } from '../types';

// ─── IN-FLIGHT REQUEST DEDUPLICATION ─────────────────────────────────────────
//
// Problem: multiple components mounting at the same time each call the same
// endpoint (e.g. /sites, /buildings) independently, flooding the server and
// triggering 429 Too Many Requests responses.
//
// Solution: for GET requests, if an identical request is already in-flight,
// return the same Promise instead of making a new network call.
// The cache is keyed by URL + serialised params and is cleared the moment
// the request settles (success or error), so subsequent calls always get
// fresh data.

const inFlight = new Map<string, Promise<any>>();

function dedupedGet<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  const key = url + (params ? '?' + new URLSearchParams(
    // filter out undefined/null so keys are deterministic
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
    )
  ).toString() : '');

  if (inFlight.has(key)) {
    return inFlight.get(key)! as Promise<T>;
  }

  const promise = api
    .get<T>(url, params ? { params } : undefined)
    .finally(() => inFlight.delete(key)) as Promise<T>;

  inFlight.set(key, promise);
  return promise;
}

// ─── AUTH ─────────────────────────────────────────────────────────────
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  registerTenant: (data: any) =>
    api.post('/auth/register-tenant', data),
  register: (data: any) =>
    api.post('/auth/register', data),
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh-token', { refreshToken }),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  requestPasswordReset: (email: string) =>
    api.post('/auth/request-reset-password-email', { email }),
  resetPassword: (newPassword: string, resetPasswordToken: string) =>
    api.post('/auth/reset-password', { newPassword, resetPasswordToken }),
  me: () => api.get('/auth/me'),
  getSessions: () => api.get('/auth/sessions'),
  getLoginActivity: () => api.get('/auth/login-activity'),
  revokeSession: (sessionId: string) => api.delete(`/auth/sessions/${sessionId}`),
  revokeOtherSessions: () => api.post('/auth/sessions/revoke-others'),
};

// ─── SITES (legacy alias → buildings; sites table removed) ─────────────
function mapBuildingAsSite(b: Building) {
  return {
    ...b,
    id: b.id,
    tenant_id: b.tenant_id,
    name: b.name,
    slug: b.slug,
    code: b.slug ?? b.name,
    status: 'ACTIVE',
    floors_count: b.floors?.length ?? b.floors_count ?? 0,
  };
}

export const siteApi = {
  getAll: async (tenantId?: string) => {
    const list = await buildingApi.getAll(tenantId);
    return list.map(mapBuildingAsSite);
  },
  getOne: (id: string) => buildingApi.getOne(id),
  create: (data: any) => api.post('/sites', data),
  update: (id: string, data: any) => api.patch(`/sites/${id}`, data),
  remove: (id: string) => api.delete(`/sites/${id}`),
  getAvailableSpaces: (id: string) => api.get(`/sites/${id}/available-spaces`),
  getOccupancyRate: (id: string) => api.get(`/sites/${id}/occupancy-rate`),
  gmbStatus: (id: string) => api.get(`/sites/${id}/google-business/status`),
  gmbOAuthUrl: (id: string) => api.get(`/sites/${id}/google-business/oauth-url`),
  gmbLocations: (id: string) => api.get(`/sites/${id}/google-business/locations`),
  gmbSetLocation: (id: string, data: { gmb_location_id?: string | null }) =>
    api.patch(`/sites/${id}/google-business/location`, data),
  gmbDisconnect: (id: string) => api.post(`/sites/${id}/google-business/disconnect`),
  gmbSync: (id: string) => api.post(`/sites/${id}/google-business/sync`),
};

// ─── Tenant applications (Typeform) ───────────────────────────────────
export const applicationFormsApi = {
  createTypeformInquiry: (data: { space_id: string }) =>
    api.post('/forms/typeform/inquiry', data),
  simulateLocal: (inquiryId: string, data?: { email?: string; companyName?: string }) =>
    api.post(`/forms/typeform/simulate/${inquiryId}`, data ?? {}),
};

export const tenantApplicationsApi = {
  listPending: () => api.get('/tenant-applications/pending'),
  approve: (id: string) => api.post(`/tenant-applications/${id}/approve`),
  reject: (id: string, data?: { reason?: string }) =>
    api.post(`/tenant-applications/${id}/reject`, data ?? {}),
};

export const bookingApplicationApi = {
  getAll: (params?: { status?: string }) =>
    dedupedGet('/booking-applications', params),
  getOne: (id: string) => api.get(`/booking-applications/${id}`),
  createGuest: (data: {
    space_id: string;
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    applicant_type?: 'INDIVIDUAL' | 'COMPANY';
    company_name?: string;
    start_date: string;
    duration_months: number;
    headcount: number;
    intended_use: string;
    message?: string;
    addons?: { addon_service_id: string; quantity: number }[];
  }) => api.post('/booking-applications/guest', data),
  create: (data: {
    space_id: string;
    start_date: string;
    duration_months: number;
    headcount: number;
    intended_use: string;
    message?: string;
    addons?: { addon_service_id: string; quantity: number }[];
  }) => api.post('/booking-applications', data),
  accept: (id: string) => api.patch(`/booking-applications/${id}/accept`),
  refuse: (id: string, data?: { reason?: string }) =>
    api.patch(`/booking-applications/${id}/refuse`, data ?? {}),
};

// ─── BUILDINGS ────────────────────────────────────────────────────────
export const buildingApi = {
  getAll: async (tenantId?: string) => {
    const res = await dedupedGet('/buildings', tenantId ? { tenantId } : undefined);
    return listFromApi<Building>(res);
  },
  getOne: (id: string) => api.get(`/buildings/${id}`),
  create: (data: any) => api.post('/buildings', data),
  update: (id: string, data: any) => api.patch(`/buildings/${id}`, data),
  remove: (id: string) => api.delete(`/buildings/${id}`),
  ensureFloor: (id: string) => api.post(`/buildings/${id}/ensure-floor`),
};

// ─── FLOORS ───────────────────────────────────────────────────────────
export const floorApi = {
  getAll: async (buildingId?: string) => {
    const res = await dedupedGet('/floors', buildingId ? { buildingId } : undefined);
    return listFromApi<Floor>(res);
  },
  getPublishDefault: () => api.get('/floors/publish-default'),
  ensureDefault: async (buildingId: string) => {
    try {
      return await api.post('/floors/ensure-default', { building_id: buildingId });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return buildingApi.ensureFloor(buildingId);
      }
      throw err;
    }
  },
  getOne: (id: string) => api.get(`/floors/${id}`),
  create: (data: any) => api.post('/floors', data),
  update: (id: string, data: any) => api.patch(`/floors/${id}`, data),
  remove: (id: string) => api.delete(`/floors/${id}`),
};

// ─── SPACES ───────────────────────────────────────────────────────────
export const spaceApi = {
  getAll: async (params?: { floorId?: string; type?: string; status?: string }) => {
    const res = await dedupedGet('/spaces', params);
    return listFromApi<Space>(res);
  },
  getPublishedMap: async () => {
    const res = await dedupedGet('/spaces/public/map');
    return listFromApi<Space>(res);
  },
  getPublishedOne: (id: string) => dedupedGet(`/spaces/public/${id}`),
  getOne: (id: string) => api.get(`/spaces/${id}`),
  create: (data: any) => api.post('/spaces', data),
  update: (id: string, data: any) => api.patch(`/spaces/${id}`, data),
  remove: (id: string) => api.delete(`/spaces/${id}`),
  checkAvailability: (id: string, start: string, end: string) =>
    api.get(`/spaces/${id}/availability`, { params: { start, end } }),
  updateMapPosition: (id: string, data: { map_x: number; map_y: number; map_w?: number; map_h?: number }) =>
    api.patch(`/spaces/${id}/map-position`, data),
  clearMapPosition: (id: string) =>
    api.delete(`/spaces/${id}/map-position`),
};

// ─── TENANTS ──────────────────────────────────────────────────────────
export const tenantApi = {
  getAll: (params?: { type?: 'CLIENT' | 'RENTER' }) =>
    dedupedGet('/tenants', params),
  getOne: (id: string) => api.get(`/tenants/${id}`),
  create: (data: any) => api.post('/tenants', data),
  provisionClient: (data: {
    company_name: string;
    contact_email: string;
    subscription_plan?: string;
    send_welcome_email?: boolean;
  }) => api.post('/tenants/provision-client', data),
  update: (id: string, data: any) => api.patch(`/tenants/${id}`, data),
  remove: (id: string) => api.delete(`/tenants/${id}`),
  suspend: (id: string) => api.patch(`/tenants/${id}/suspend`),
  activate: (id: string) => api.patch(`/tenants/${id}/activate`),
  getActiveUsers: (id: string) => api.get(`/tenants/${id}/active-users`),
  updateReportingEmbeds: (
    id: string,
    data: {
      powerBi?: { title?: string; embedUrl?: string };
      tableau?: { title?: string; embedUrl?: string };
    },
  ) => api.patch(`/tenants/${id}/reporting-embeds`, data),
  getMyOrganization: () => api.get('/tenants/me/organization'),
  updateMyOrganization: (data: Record<string, unknown>) =>
    api.patch('/tenants/me/organization', data),
};

// ─── USERS ────────────────────────────────────────────────────────────
export const userApi = {
  getAll: (tenantId?: string, role?: string) =>
    dedupedGet('/users', {
      ...(tenantId ? { tenantId } : {}),
      ...(role ? { role } : {}),
    }),
  getOne: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  invite: (data: any) => api.post('/users/invite', data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`),
  changePassword: (id: string, data: { currentPassword: string; newPassword: string }) =>
    api.patch(`/users/${id}/change-password`, data),
};

// ─── BOOKINGS ─────────────────────────────────────────────────────────
export const bookingApi = {
  getAll: (params?: { tenantId?: string; spaceId?: string; status?: string; createdBy?: string }) =>
    dedupedGet('/bookings', params),
  getOne: (id: string) => api.get(`/bookings/${id}`),
  create: (data: any) => api.post('/bookings', data),
  update: (id: string, data: any) => api.patch(`/bookings/${id}`, data),
  remove: (id: string) => api.delete(`/bookings/${id}`),
  approve: (id: string, approvedByUserId: string) =>
    api.patch(`/bookings/${id}/approve`, {}, { params: { approvedByUserId } }),
  reject: (id: string, reason?: string) =>
    api.patch(`/bookings/${id}/reject`, {}, { ...(reason ? { params: { reason } } : {}) }),
  cancel: (id: string, reason?: string) =>
    api.patch(`/bookings/${id}/cancel`, {}, { ...(reason ? { params: { reason } } : {}) }),
  checkIn: (id: string) => api.patch(`/bookings/${id}/check-in`, {}),
  checkOut: (id: string) => api.patch(`/bookings/${id}/check-out`, {}),
  addAddon: (id: string, data: any) => api.post(`/bookings/${id}/addons`, data),
  removeAddon: (id: string, addonId: string) =>
    api.delete(`/bookings/${id}/addons/${addonId}`),
  getWorkflowQueues: () => dedupedGet('/bookings/workflow/queues'),
  confirmPhone: (id: string) => api.patch(`/bookings/${id}/phone-confirmed`, {}),
  phoneUnreachable: (id: string, reason?: string) =>
    api.patch(`/bookings/${id}/phone-unreachable`, {}, { ...(reason ? { params: { reason } } : {}) }),
  markDocumentsPending: (id: string) => api.patch(`/bookings/${id}/mark-documents-pending`, {}),
  uploadDocument: (id: string, file: File, documentType?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (documentType) form.append('document_type', documentType);
    form.append('file_name', file.name);
    return api.post(`/bookings/${id}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeDocument: (id: string, documentId: string) =>
    api.delete(`/bookings/${id}/documents/${documentId}`),
  finalize: (id: string) => api.patch(`/bookings/${id}/finalize`, {}),
};

// ─── LEASE CONTRACTS ──────────────────────────────────────────────────
export const contractApi = {
  getAll: (params?: { tenantId?: string; status?: string }) =>
    dedupedGet('/lease-contracts', params),
  getExpiring: (daysAhead?: number) =>
    dedupedGet('/lease-contracts/expiring', daysAhead ? { daysAhead } : undefined),
  getOne: (id: string) => api.get(`/lease-contracts/${id}`),
  create: (data: any) => api.post('/lease-contracts', data),
  update: (id: string, data: any) => api.patch(`/lease-contracts/${id}`, data),
  remove: (id: string) => api.delete(`/lease-contracts/${id}`),
  sign: (id: string) => api.patch(`/lease-contracts/${id}/sign`),
  terminate: (id: string) => api.patch(`/lease-contracts/${id}/terminate`),
  renew: (id: string, newEndDate: string) =>
    api.patch(`/lease-contracts/${id}/renew`, null, { params: { newEndDate } }),
  addItem: (id: string, data: any) =>
    api.post(`/lease-contracts/${id}/items`, data),
  removeItem: (id: string, itemId: string) =>
    api.delete(`/lease-contracts/${id}/items/${itemId}`),
  createDeposit: (id: string, data: any) =>
    api.post(`/lease-contracts/${id}/deposit`, data),
  refundDeposit: (id: string, data: any) =>
    api.patch(`/lease-contracts/${id}/deposit/refund`, data),
};

// ─── BILLING ──────────────────────────────────────────────────────────
export const billingApi = {
  getInvoices: (params?: { tenantId?: string; status?: string; type?: string }) =>
    dedupedGet('/billing/invoices', params),
  getOverdueInvoices: (tenantId?: string) =>
    dedupedGet('/billing/invoices/overdue', tenantId ? { tenantId } : undefined),
  getFinancialSummary: (tenantId?: string) =>
    dedupedGet('/billing/invoices/summary', tenantId ? { tenantId } : undefined),
  getOneInvoice: (id: string) => api.get(`/billing/invoices/${id}`),
  createInvoice: (data: any) => api.post('/billing/invoices', data),
  updateInvoice: (id: string, data: any) => api.patch(`/billing/invoices/${id}`, data),
  sendInvoice: (id: string) => api.patch(`/billing/invoices/${id}/send`),
  cancelInvoice: (id: string) => api.patch(`/billing/invoices/${id}/cancel`),
  deleteInvoice: (id: string) => api.delete(`/billing/invoices/${id}`),
  addInvoiceLine: (id: string, data: any) =>
    api.post(`/billing/invoices/${id}/lines`, data),
  removeInvoiceLine: (id: string, lineId: string) =>
    api.delete(`/billing/invoices/${id}/lines/${lineId}`),
  getPayments: (params?: { tenantId?: string; invoiceId?: string }) =>
    dedupedGet('/billing/payments', params),
  getOnePayment: (id: string) => api.get(`/billing/payments/${id}`),
  createPayment: (data: any) => api.post('/billing/payments', data),
  uploadPaymentCheque: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/billing/payments/${id}/cheque-document`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  confirmPayment: (id: string) => api.patch(`/billing/payments/${id}/confirm`),
  refundPayment: (id: string) => api.patch(`/billing/payments/${id}/refund`),
};

// ─── MAINTENANCE ──────────────────────────────────────────────────────
export const maintenanceApi = {
  getAccessibleSpaces: () => dedupedGet('/maintenance/accessible-spaces'),
  getAll: (params?: {
    spaceId?: string;
    status?: string;
    priority?: string;
    category?: string;
    assignedTo?: string;
    view?: 'available' | 'mine' | 'all';
  }) =>
    dedupedGet('/maintenance', params),
  getStats: (spaceId?: string) =>
    dedupedGet('/maintenance/stats', spaceId ? { spaceId } : undefined),
  getOne: (id: string) => api.get(`/maintenance/${id}`),
  create: (data: any) => api.post('/maintenance', data),
  update: (id: string, data: any) => api.patch(`/maintenance/${id}`, data),
  remove: (id: string) => api.delete(`/maintenance/${id}`),
  assign: (id: string, userId: string) =>
    api.patch(`/maintenance/${id}/assign`, {}, { params: { userId } }),
  accept: (id: string) => api.patch(`/maintenance/${id}/accept`, {}),
  start: (id: string) => api.patch(`/maintenance/${id}/start`, {}),
  resolve: (id: string, cost?: number) =>
    api.patch(`/maintenance/${id}/resolve`, {}, {
      ...(cost !== undefined ? { params: { cost } } : {}),
    }),
  close: (id: string) => api.patch(`/maintenance/${id}/close`, {}),
  cancel: (id: string) => api.patch(`/maintenance/${id}/cancel`, {}),
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────
export const notificationApi = {
  getAll: (params?: { userId?: string; isRead?: string; type?: string }) =>
    dedupedGet('/notifications', params),
  getUnreadCount: (userId: string) =>
    dedupedGet('/notifications/unread-count', { userId }),
  getOne: (id: string) => api.get(`/notifications/${id}`),
  getStats: (userId?: string) =>
    dedupedGet('/notifications/stats', userId ? { userId } : undefined),
  create: (data: any) => api.post('/notifications', data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: (userId?: string) =>
    api.patch(`/notifications/read-all${userId ? `/${userId}` : ''}`),
  remove: (id: string) => api.delete(`/notifications/${id}`),
  getMyPreferences: () => api.get('/notifications/preferences/me'),
  updateMyPreferences: (data: Record<string, unknown>) =>
    api.put('/notifications/preferences/me', data),
};

// ─── AUDIT ────────────────────────────────────────────────────────────
export const auditApi = {
  getAll: (params?: any) => dedupedGet('/audit', params),
  getOne: (id: string) => api.get(`/audit/${id}`),
};

// ─── EXPORT ───────────────────────────────────────────────────────────
const multipartConfig = {
  headers: { 'Content-Type': undefined as any },
};

export const exportApi = {
  bookings:    (format: 'xlsx' | 'csv', params?: Record<string, string>) =>
    api.get(`/export/bookings?format=${format}${params ? '&' + new URLSearchParams(params).toString() : ''}`, { responseType: 'blob' }),
  invoices:    (format: 'xlsx' | 'csv', params?: Record<string, string>) =>
    api.get(`/export/invoices?format=${format}${params ? '&' + new URLSearchParams(params).toString() : ''}`, { responseType: 'blob' }),
  payments:    (format: 'xlsx' | 'csv', params?: Record<string, string>) =>
    api.get(`/export/payments?format=${format}${params ? '&' + new URLSearchParams(params).toString() : ''}`, { responseType: 'blob' }),
  tenants:     (format: 'xlsx' | 'csv') =>
    api.get(`/export/tenants?format=${format}`, { responseType: 'blob' }),
  spaces:      (format: 'xlsx' | 'csv') =>
    api.get(`/export/spaces?format=${format}`, { responseType: 'blob' }),
  maintenance: (format: 'xlsx' | 'csv', params?: Record<string, string>) =>
    api.get(`/export/maintenance?format=${format}${params ? '&' + new URLSearchParams(params).toString() : ''}`, { responseType: 'blob' }),
};

// ─── ANALYTICS ────────────────────────────────────────────────────────
const analyticsQuery = (from: string, to: string, tenantId?: string) => {
  const q = new URLSearchParams({ from, to });
  if (tenantId) q.set('tenantId', tenantId);
  return q.toString();
};

export const analyticsApi = {
  getOverview:        (from: string, to: string, tenantId?: string) =>
    api.get(`/analytics/overview?${analyticsQuery(from, to, tenantId)}`),
  getRevenueTrend:    (from: string, to: string, tenantId?: string) =>
    api.get(`/analytics/revenue-trend?${analyticsQuery(from, to, tenantId)}`),
  getBookingsTrend:   (from: string, to: string, tenantId?: string) =>
    api.get(`/analytics/bookings-trend?${analyticsQuery(from, to, tenantId)}`),
  getBookingStatus:   (from: string, to: string, tenantId?: string) =>
    api.get(`/analytics/bookings-by-status?${analyticsQuery(from, to, tenantId)}`),
  getSpaceUtil:       () => api.get(`/analytics/space-utilization`),
  getMaintenance:     (from: string, to: string, tenantId?: string) =>
    api.get(`/analytics/maintenance?${analyticsQuery(from, to, tenantId)}`),
  getTopSpaces:       (from: string, to: string, tenantId?: string) =>
    api.get(`/analytics/top-spaces?${analyticsQuery(from, to, tenantId)}`),
  getRevenueByTenant: (from: string, to: string) =>
    api.get(`/analytics/revenue-by-tenant?${analyticsQuery(from, to)}`),
  getOccupancyHeatmap: (siteId: string, from?: string, to?: string) =>
    dedupedGet('/analytics/occupancy-heatmap', {
      siteId,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
  getRevenueForecast: (params?: { tenantId?: string; horizonMonths?: number }) =>
    dedupedGet('/analytics/revenue-forecast', params),
  getPredictiveMaintenance: (params?: { tenantId?: string; siteId?: string }) =>
    dedupedGet('/analytics/predictive-maintenance', params),
};

// ─── AI (OpenAI) ─────────────────────────────────────────────────────
export const aiApi = {
  leaseAssistant: (messages: { role: string; content: string }[]) =>
    api.post('/ai/lease-assistant', { messages }),
  tenantAssistant: (messages: { role: string; content: string }[]) =>
    api.post('/ai/tenant-assistant', { messages }),
  suggestMaintenanceCategory: (title: string, description?: string) =>
    api.post('/ai/maintenance/suggest-category', { title, description }),
};

// ─── UPLOADS ──────────────────────────────────────────────────────────
export const uploadApi = {
  uploadSpacePhotos: (spaceId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return api.post(`/upload/space/${spaceId}/photos`, form, multipartConfig);
  },
  deleteSpacePhoto: (spaceId: string, url: string) =>
    api.delete(`/upload/space/${spaceId}/photo`, { data: { url } }),
  uploadFloorPlan: (floorId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/upload/floor/${floorId}/plan`, form, multipartConfig);
  },
  uploadContractDocument: (contractId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/upload/contract/${contractId}/document`, form, multipartConfig);
  },
  uploadInvoiceDocument: (invoiceId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/upload/invoice/${invoiceId}/document`, form, multipartConfig);
  },
  uploadAvatar: (userId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/upload/user/${userId}/avatar`, form, multipartConfig);
  },
};

// ─── ADDON SERVICES ───────────────────────────────────────────────────────────
export const addonServiceApi = {
  getAll: (params?: {
    tenantId?: string;
    category?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    search?: string;
  }) => dedupedGet('/addon-services', params),
  getOne: (id: string) =>
    api.get(`/addon-services/${id}`),
  create: (data: any) =>
    api.post('/addon-services', data),
  update: (id: string, data: any) =>
    api.patch(`/addon-services/${id}`, data),
  remove: (id: string) =>
    api.delete(`/addon-services/${id}`),
  activate: (id: string) =>
    api.post(`/addon-services/${id}/activate`),
  deactivate: (id: string) =>
    api.post(`/addon-services/${id}/deactivate`),
  getActive: (tenantId?: string) =>
    dedupedGet('/addon-services/active', tenantId ? { tenantId } : undefined),
};

// ─── SPACE FEATURES ───────────────────────────────────────────────────────────
export const spaceFeatureApi = {
  getAll: (siteId?: string) =>
    dedupedGet('/space-features', siteId ? { siteId } : undefined),
  getOne: (id: string) => api.get(`/space-features/${id}`),
  create: (data: any) => api.post('/space-features', data),
  update: (id: string, data: any) => api.patch(`/space-features/${id}`, data),
  remove: (id: string) => api.delete(`/space-features/${id}`),
};

// ─── PROMOTION CODES ──────────────────────────────────────────────────────────
export const promotionCodeApi = {
  getAll: (params?: {
    isActive?: boolean;
    page?: number;
    limit?: number;
    search?: string;
  }) => dedupedGet('/promotion-codes', params),
  getOne: (id: string) => api.get(`/promotion-codes/${id}`),
  create: (data: any) => api.post('/promotion-codes', data),
  update: (id: string, data: any) => api.patch(`/promotion-codes/${id}`, data),
  remove: (id: string) => api.delete(`/promotion-codes/${id}`),
  /** Read-only check that a code is usable right now. */
  validate: (code: string) => api.get(`/promotion-codes/validate/${code}`),
  /** Consumes one use of the code — POST because it mutates the counter. */
  apply: (code: string, amount: number) =>
    api.post(`/promotion-codes/apply/${code}`, { amount }),
};