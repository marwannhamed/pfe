import { api } from './client';

// â”€â”€â”€ AUTH  /auth/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const authApi = {
  login:                (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  registerTenant:       (data: any) =>
    api.post('/auth/register-tenant', data),

  register:             (data: any) =>
    api.post('/auth/register', data),

  refreshToken:         (refreshToken: string) =>
    api.post('/auth/refresh-token', { refreshToken }),

  requestPasswordReset: (email: string) =>
    api.post('/auth/request-reset-password-email', { email }),

  resetPassword:        (newPassword: string, resetPasswordToken: string) =>
    api.post('/auth/reset-password', { newPassword, resetPasswordToken }),

  me: () =>
    api.get('/auth/me'),
};

// â”€â”€â”€ SITES  /sites â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const siteApi = {
  getAll: (tenantId?: string) =>
    api.get('/sites', { params: tenantId ? { tenantId } : {} }),

  getOne: (id: string) =>
    api.get(`/sites/${id}`),

  create: (data: any) =>
    api.post('/sites', data),

  update: (id: string, data: any) =>
    api.patch(`/sites/${id}`, data),

  remove: (id: string) =>
    api.delete(`/sites/${id}`),

  getAvailableSpaces: (id: string) =>
    api.get(`/sites/${id}/available-spaces`),

  getOccupancyRate: (id: string) =>
    api.get(`/sites/${id}/occupancy-rate`),
};

// â”€â”€â”€ BUILDINGS  /buildings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const buildingApi = {
  getAll:  (siteId?: string) =>
    api.get('/buildings', { params: siteId ? { siteId } : {} }),
  getOne:  (id: string) =>
    api.get(`/buildings/${id}`),
  create:  (data: any) =>
    api.post('/buildings', data),
  update:  (id: string, data: any) =>
    api.patch(`/buildings/${id}`, data),
  remove:  (id: string) =>
    api.delete(`/buildings/${id}`),
};

// â”€â”€â”€ FLOORS  /floors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const floorApi = {
  getAll:  (buildingId?: string) =>
    api.get('/floors', { params: buildingId ? { buildingId } : {} }),
  getOne:  (id: string) =>
    api.get(`/floors/${id}`),
  create:  (data: any) =>
    api.post('/floors', data),
  update:  (id: string, data: any) =>
    api.patch(`/floors/${id}`, data),
  remove:  (id: string) =>
    api.delete(`/floors/${id}`),
};

// â”€â”€â”€ SPACES  /spaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const spaceApi = {
  getAll: (params?: { floorId?: string; type?: string; status?: string }) =>
    api.get('/spaces', { params }),

  getOne: (id: string) =>
    api.get(`/spaces/${id}`),

  create: (data: any) =>
    api.post('/spaces', data),

  update: (id: string, data: any) =>
    api.patch(`/spaces/${id}`, data),

  remove: (id: string) =>
    api.delete(`/spaces/${id}`),

  checkAvailability: (id: string, start: string, end: string) =>
    api.get(`/spaces/${id}/availability`, { params: { start, end } }),
};

// â”€â”€â”€ TENANTS  /tenants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const tenantApi = {
  getAll: () =>
    api.get('/tenants'),

  getOne: (id: string) =>
    api.get(`/tenants/${id}`),

  create: (data: any) =>
    api.post('/tenants', data),

  update: (id: string, data: any) =>
    api.patch(`/tenants/${id}`, data),

  remove: (id: string) =>
    api.delete(`/tenants/${id}`),

  suspend: (id: string) =>
    api.patch(`/tenants/${id}/suspend`),

  activate: (id: string) =>
    api.patch(`/tenants/${id}/activate`),

  getActiveUsers: (id: string) =>
    api.get(`/tenants/${id}/active-users`),
};

// â”€â”€â”€ USERS  /users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const userApi = {
  getAll: (tenantId?: string) =>
    api.get('/users', { params: tenantId ? { tenantId } : {} }),

  getOne: (id: string) =>
    api.get(`/users/${id}`),

  create: (data: any) =>
    api.post('/users', data),

  update: (id: string, data: any) =>
    api.patch(`/users/${id}`, data),

  remove: (id: string) =>
    api.delete(`/users/${id}`),

  // âœ… Change password endpoint
  changePassword: (id: string, data: { currentPassword: string; newPassword: string }) =>
    api.patch(`/users/${id}/change-password`, data),
};

// â”€â”€â”€ BOOKINGS  /bookings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const bookingApi = {
  getAll: (params?: { tenantId?: string; spaceId?: string; status?: string; createdBy?: string }) =>
    api.get('/bookings', { params }),

  getOne: (id: string) =>
    api.get(`/bookings/${id}`),

  create: (data: any) =>
    api.post('/bookings', data),

  update: (id: string, data: any) =>
    api.patch(`/bookings/${id}`, data),

  remove: (id: string) =>
    api.delete(`/bookings/${id}`),

  approve: (id: string, approvedByUserId: string) =>
    api.patch(`/bookings/${id}/approve`, null, { params: { approvedByUserId } }),

  cancel: (id: string) =>
    api.patch(`/bookings/${id}/cancel`),

  checkIn: (id: string) =>
    api.patch(`/bookings/${id}/check-in`),

  checkOut: (id: string) =>
    api.patch(`/bookings/${id}/check-out`),

  addAddon: (id: string, data: any) =>
    api.post(`/bookings/${id}/addons`, data),

  removeAddon: (id: string, addonId: string) =>
    api.delete(`/bookings/${id}/addons/${addonId}`),
};

// â”€â”€â”€ LEASE CONTRACTS  /lease-contracts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const contractApi = {
  getAll: (params?: { tenantId?: string; status?: string }) =>
    api.get('/lease-contracts', { params }),

  getExpiring: (daysAhead?: number) =>
    api.get('/lease-contracts/expiring', { params: daysAhead ? { daysAhead } : {} }),

  getOne: (id: string) =>
    api.get(`/lease-contracts/${id}`),

  create: (data: any) =>
    api.post('/lease-contracts', data),

  update: (id: string, data: any) =>
    api.patch(`/lease-contracts/${id}`, data),

  remove: (id: string) =>
    api.delete(`/lease-contracts/${id}`),

  sign: (id: string) =>
    api.patch(`/lease-contracts/${id}/sign`),

  terminate: (id: string) =>
    api.patch(`/lease-contracts/${id}/terminate`),

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

// â”€â”€â”€ BILLING  /billing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const billingApi = {
  getInvoices: (params?: { tenantId?: string; status?: string; type?: string }) =>
    api.get('/billing/invoices', { params }),

  getOverdueInvoices: (tenantId?: string) =>
    api.get('/billing/invoices/overdue', { params: tenantId ? { tenantId } : {} }),

  getFinancialSummary: (tenantId?: string) =>
    api.get('/billing/invoices/summary', { params: tenantId ? { tenantId } : {} }),

  getOneInvoice: (id: string) =>
    api.get(`/billing/invoices/${id}`),

  createInvoice: (data: any) =>
    api.post('/billing/invoices', data),

  updateInvoice: (id: string, data: any) =>
    api.patch(`/billing/invoices/${id}`, data),

  sendInvoice: (id: string) =>
    api.patch(`/billing/invoices/${id}/send`),

  cancelInvoice: (id: string) =>
    api.patch(`/billing/invoices/${id}/cancel`),

  deleteInvoice: (id: string) =>
    api.delete(`/billing/invoices/${id}`),

  addInvoiceLine: (id: string, data: any) =>
    api.post(`/billing/invoices/${id}/lines`, data),

  removeInvoiceLine: (id: string, lineId: string) =>
    api.delete(`/billing/invoices/${id}/lines/${lineId}`),

  getPayments: (params?: { tenantId?: string; invoiceId?: string }) =>
    api.get('/billing/payments', { params }),

  getOnePayment: (id: string) =>
    api.get(`/billing/payments/${id}`),

  createPayment: (data: any) =>
    api.post('/billing/payments', data),

  refundPayment: (id: string) =>
    api.patch(`/billing/payments/${id}/refund`),
};

// â”€â”€â”€ MAINTENANCE  /maintenance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const maintenanceApi = {
  getAll: (params?: { spaceId?: string; status?: string; priority?: string; category?: string; assignedTo?: string }) =>
    api.get('/maintenance', { params }),

  getStats: (spaceId?: string) =>
    api.get('/maintenance/stats', { params: spaceId ? { spaceId } : {} }),

  getOne: (id: string) =>
    api.get(`/maintenance/${id}`),

  create: (data: any) =>
    api.post('/maintenance', data),

  update: (id: string, data: any) =>
    api.patch(`/maintenance/${id}`, data),

  remove: (id: string) =>
    api.delete(`/maintenance/${id}`),

  assign: (id: string, userId: string) =>
    api.patch(`/maintenance/${id}/assign`, null, { params: { userId } }),

  start: (id: string) =>
    api.patch(`/maintenance/${id}/start`),

  resolve: (id: string, cost?: number) =>
    api.patch(`/maintenance/${id}/resolve`, null, { params: cost !== undefined ? { cost } : {} }),

  close: (id: string) =>
    api.patch(`/maintenance/${id}/close`),

  cancel: (id: string) =>
    api.patch(`/maintenance/${id}/cancel`),
};

// â”€â”€â”€ NOTIFICATIONS  /notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const notificationApi = {
  getAll: (params?: { userId?: string; isRead?: string; type?: string }) =>
    api.get('/notifications', { params }),

  getUnreadCount: (userId: string) =>
    api.get('/notifications/unread-count', { params: { userId } }),

  getOne: (id: string) =>
    api.get(`/notifications/${id}`),

  create: (data: any) =>
    api.post('/notifications', data),

  markRead: (id: string) =>
    api.patch(`/notifications/${id}/read`),

  markAllRead: (userId: string) =>
    api.patch(`/notifications/read-all/${userId}`),

  remove: (id: string) =>
    api.delete(`/notifications/${id}`),
};

// â”€â”€â”€ PRICE PLANS  /price-plans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const pricePlanApi = {
  getAll:  (params?: any) => api.get('/price-plans', { params }),
  getOne:  (id: string)   => api.get(`/price-plans/${id}`),
  create:  (data: any)    => api.post('/price-plans', data),
  update:  (id: string, data: any) => api.patch(`/price-plans/${id}`, data),
  remove:  (id: string)   => api.delete(`/price-plans/${id}`),
};

// â”€â”€â”€ REPORTS  /reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const reportApi = {
  getAll:  (params?: any) => api.get('/reports', { params }),
  getOne:  (id: string)   => api.get(`/reports/${id}`),
  remove:  (id: string)   => api.delete(`/reports/${id}`),
};

// â”€â”€â”€ AUDIT  /audit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const auditApi = {
  getAll: (params?: any) => api.get('/audit', { params }),
  getOne: (id: string)   => api.get(`/audit/${id}`),
};
