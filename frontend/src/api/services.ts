import { api } from './client';

// ─── AUTH  /auth/* ────────────────────────────────────────────────────────────
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

// ─── SITES  /sites ────────────────────────────────────────────────────────────
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

// ─── BUILDINGS  /buildings ────────────────────────────────────────────────────
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
 
// ─── FLOORS  /floors ──────────────────────────────────────────────────────────
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

// ─── SPACES  /spaces ──────────────────────────────────────────────────────────
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

  // GET /spaces/:id/availability?start=...&end=...
  checkAvailability: (id: string, start: string, end: string) =>
    api.get(`/spaces/${id}/availability`, { params: { start, end } }),
};

// ─── TENANTS  /tenants ────────────────────────────────────────────────────────
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

  // PATCH /tenants/:id/suspend
  suspend: (id: string) =>
    api.patch(`/tenants/${id}/suspend`),

  // PATCH /tenants/:id/activate
  activate: (id: string) =>
    api.patch(`/tenants/${id}/activate`),

  // GET /tenants/:id/active-users
  getActiveUsers: (id: string) =>
    api.get(`/tenants/${id}/active-users`),
};

// ─── USERS  /users ────────────────────────────────────────────────────────────
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
};

// ─── BOOKINGS  /bookings ──────────────────────────────────────────────────────
export const bookingApi = {
  // GET /bookings?tenantId=&spaceId=&status=
  getAll: (params?: { tenantId?: string; spaceId?: string; status?: string }) =>
    api.get('/bookings', { params }),

  getOne: (id: string) =>
    api.get(`/bookings/${id}`),

  create: (data: any) =>
    api.post('/bookings', data),

  update: (id: string, data: any) =>
    api.patch(`/bookings/${id}`, data),

  remove: (id: string) =>
    api.delete(`/bookings/${id}`),

  // PATCH /bookings/:id/approve?approvedByUserId=
  approve: (id: string, approvedByUserId: string) =>
    api.patch(`/bookings/${id}/approve`, null, { params: { approvedByUserId } }),

  // PATCH /bookings/:id/cancel
  cancel: (id: string) =>
    api.patch(`/bookings/${id}/cancel`),

  // PATCH /bookings/:id/check-in
  checkIn: (id: string) =>
    api.patch(`/bookings/${id}/check-in`),

  // PATCH /bookings/:id/check-out
  checkOut: (id: string) =>
    api.patch(`/bookings/${id}/check-out`),

  // POST /bookings/:id/addons
  addAddon: (id: string, data: any) =>
    api.post(`/bookings/${id}/addons`, data),

  // DELETE /bookings/:id/addons/:addonId
  removeAddon: (id: string, addonId: string) =>
    api.delete(`/bookings/${id}/addons/${addonId}`),
};

// ─── LEASE CONTRACTS  /lease-contracts ────────────────────────────────────────
export const contractApi = {
  // GET /lease-contracts?tenantId=&status=
  getAll: (params?: { tenantId?: string; status?: string }) =>
    api.get('/lease-contracts', { params }),

  // GET /lease-contracts/expiring?daysAhead=30
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

  // PATCH /lease-contracts/:id/sign
  sign: (id: string) =>
    api.patch(`/lease-contracts/${id}/sign`),

  // PATCH /lease-contracts/:id/terminate
  terminate: (id: string) =>
    api.patch(`/lease-contracts/${id}/terminate`),

  // PATCH /lease-contracts/:id/renew?newEndDate=
  renew: (id: string, newEndDate: string) =>
    api.patch(`/lease-contracts/${id}/renew`, null, { params: { newEndDate } }),

  // POST /lease-contracts/:id/items
  addItem: (id: string, data: any) =>
    api.post(`/lease-contracts/${id}/items`, data),

  // DELETE /lease-contracts/:id/items/:itemId
  removeItem: (id: string, itemId: string) =>
    api.delete(`/lease-contracts/${id}/items/${itemId}`),

  // POST /lease-contracts/:id/deposit
  createDeposit: (id: string, data: any) =>
    api.post(`/lease-contracts/${id}/deposit`, data),

  // PATCH /lease-contracts/:id/deposit/refund
  refundDeposit: (id: string, data: any) =>
    api.patch(`/lease-contracts/${id}/deposit/refund`, data),
};

// ─── BILLING  /billing ────────────────────────────────────────────────────────
export const billingApi = {
  // ── Invoices ──────────────────────────────────────────────────

  // GET /billing/invoices?tenantId=&status=&type=
  getInvoices: (params?: { tenantId?: string; status?: string; type?: string }) =>
    api.get('/billing/invoices', { params }),

  // GET /billing/invoices/overdue?tenantId=
  getOverdueInvoices: (tenantId?: string) =>
    api.get('/billing/invoices/overdue', { params: tenantId ? { tenantId } : {} }),

  // GET /billing/invoices/summary?tenantId=
  getFinancialSummary: (tenantId?: string) =>
    api.get('/billing/invoices/summary', { params: tenantId ? { tenantId } : {} }),

  getOneInvoice: (id: string) =>
    api.get(`/billing/invoices/${id}`),

  createInvoice: (data: any) =>
    api.post('/billing/invoices', data),

  updateInvoice: (id: string, data: any) =>
    api.patch(`/billing/invoices/${id}`, data),

  // PATCH /billing/invoices/:id/send
  sendInvoice: (id: string) =>
    api.patch(`/billing/invoices/${id}/send`),

  // PATCH /billing/invoices/:id/cancel
  cancelInvoice: (id: string) =>
    api.patch(`/billing/invoices/${id}/cancel`),

  deleteInvoice: (id: string) =>
    api.delete(`/billing/invoices/${id}`),

  // POST /billing/invoices/:id/lines
  addInvoiceLine: (id: string, data: any) =>
    api.post(`/billing/invoices/${id}/lines`, data),

  // DELETE /billing/invoices/:id/lines/:lineId
  removeInvoiceLine: (id: string, lineId: string) =>
    api.delete(`/billing/invoices/${id}/lines/${lineId}`),

  // ── Payments ──────────────────────────────────────────────────

  // GET /billing/payments?tenantId=&invoiceId=
  getPayments: (params?: { tenantId?: string; invoiceId?: string }) =>
    api.get('/billing/payments', { params }),

  getOnePayment: (id: string) =>
    api.get(`/billing/payments/${id}`),

  createPayment: (data: any) =>
    api.post('/billing/payments', data),

  // PATCH /billing/payments/:id/refund
  refundPayment: (id: string) =>
    api.patch(`/billing/payments/${id}/refund`),
};

// ─── MAINTENANCE  /maintenance ────────────────────────────────────────────────
export const maintenanceApi = {
  // GET /maintenance?spaceId=&status=&priority=&category=&assignedTo=
  getAll: (params?: {
    spaceId?:    string;
    status?:     string;
    priority?:   string;
    category?:   string;
    assignedTo?: string;
  }) =>
    api.get('/maintenance', { params }),

  // GET /maintenance/stats?spaceId=
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

  // PATCH /maintenance/:id/assign?userId=
  assign: (id: string, userId: string) =>
    api.patch(`/maintenance/${id}/assign`, null, { params: { userId } }),

  // PATCH /maintenance/:id/start
  start: (id: string) =>
    api.patch(`/maintenance/${id}/start`),

  // PATCH /maintenance/:id/resolve?cost=
  resolve: (id: string, cost?: number) =>
    api.patch(`/maintenance/${id}/resolve`, null, { params: cost !== undefined ? { cost } : {} }),

  // PATCH /maintenance/:id/close
  close: (id: string) =>
    api.patch(`/maintenance/${id}/close`),

  // PATCH /maintenance/:id/cancel
  cancel: (id: string) =>
    api.patch(`/maintenance/${id}/cancel`),
};

// ─── NOTIFICATIONS  /notifications ───────────────────────────────────────────
export const notificationApi = {
  // GET /notifications?userId=&isRead=&type=
  getAll: (params?: { userId?: string; isRead?: string; type?: string }) =>
    api.get('/notifications', { params }),

  // GET /notifications/unread-count?userId=
  getUnreadCount: (userId: string) =>
    api.get('/notifications/unread-count', { params: { userId } }),

  getOne: (id: string) =>
    api.get(`/notifications/${id}`),

  create: (data: any) =>
    api.post('/notifications', data),

  // PATCH /notifications/:id/read
  markRead: (id: string) =>
    api.patch(`/notifications/${id}/read`),

  // PATCH /notifications/read-all/:userId
  markAllRead: (userId: string) =>
    api.patch(`/notifications/read-all/${userId}`),

  remove: (id: string) =>
    api.delete(`/notifications/${id}`),
};

// ─── PRICE PLANS  /price-plans ────────────────────────────────────────────────
export const pricePlanApi = {
  getAll:  (params?: any) => api.get('/price-plans', { params }),
  getOne:  (id: string)   => api.get(`/price-plans/${id}`),
  create:  (data: any)    => api.post('/price-plans', data),
  update:  (id: string, data: any) => api.patch(`/price-plans/${id}`, data),
  remove:  (id: string)   => api.delete(`/price-plans/${id}`),
};

// ─── REPORTS  /reports ────────────────────────────────────────────────────────
export const reportApi = {
  getAll:  (params?: any) => api.get('/reports', { params }),
  getOne:  (id: string)   => api.get(`/reports/${id}`),
  remove:  (id: string)   => api.delete(`/reports/${id}`),
};

// ─── AUDIT  /audit ────────────────────────────────────────────────────────────
export const auditApi = {
  getAll: (params?: any) => api.get('/audit', { params }),
  getOne: (id: string)   => api.get(`/audit/${id}`),
};