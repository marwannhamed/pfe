import api from './config';

// Email Template Management
export const emailTemplateApi = {
  // Get all email templates
  getAll: () => api.get('/email-templates'),
  
  // Get template by ID
  getById: (id: string) => api.get(`/email-templates/${id}`),
  
  // Create new template
  create: (data: any) => api.post('/email-templates', data),
  
  // Update template
  update: (id: string, data: any) => api.put(`/email-templates/${id}`, data),
  
  // Delete template
  delete: (id: string) => api.delete(`/email-templates/${id}`),
  
  // Duplicate template
  duplicate: (id: string, name: string) => api.post(`/email-templates/${id}/duplicate`, { name }),
  
  // Preview template
  preview: (id: string, data: any) => api.post(`/email-templates/${id}/preview`, data),
};

// Email Campaign Management
export const emailCampaignApi = {
  // Get all campaigns
  getAll: (params?: any) => api.get('/email-campaigns', { params }),
  
  // Get campaign by ID
  getById: (id: string) => api.get(`/email-campaigns/${id}`),
  
  // Create campaign
  create: (data: any) => api.post('/email-campaigns', data),
  
  // Update campaign
  update: (id: string, data: any) => api.put(`/email-campaigns/${id}`, data),
  
  // Delete campaign
  delete: (id: string) => api.delete(`/email-campaigns/${id}`),
  
  // Send campaign
  send: (id: string, options?: any) => api.post(`/email-campaigns/${id}/send`, options),
  
  // Pause campaign
  pause: (id: string) => api.post(`/email-campaigns/${id}/pause`),
  
  // Resume campaign
  resume: (id: string) => api.post(`/email-campaigns/${id}/resume`),
  
  // Get campaign statistics
  getStats: (id: string) => api.get(`/email-campaigns/${id}/stats`),
};

// Email Analytics
export const emailAnalyticsApi = {
  // Get email statistics
  getStats: (params?: any) => api.get('/email-analytics/stats', { params }),
  
  // Get delivery reports
  getDeliveryReport: (params?: any) => api.get('/email-analytics/delivery', { params }),
  
  // Get engagement reports
  getEngagementReport: (params?: any) => api.get('/email-analytics/engagement', { params }),
  
  // Get bounce reports
  getBounceReport: (params?: any) => api.get('/email-analytics/bounces', { params }),
  
  // Get spam reports
  getSpamReport: (params?: any) => api.get('/email-analytics/spam', { params }),
  
  // Get unsubscribe reports
  getUnsubscribeReport: (params?: any) => api.get('/email-analytics/unsubscribes', { params }),
  
  // Get email performance over time
  getPerformanceTrend: (params?: any) => api.get('/email-analytics/performance-trend', { params }),
};

// Email Configuration
export const emailConfigApi = {
  // Get email configuration
  getConfig: () => api.get('/email-config'),
  
  // Update email configuration
  updateConfig: (data: any) => api.put('/email-config', data),
  
  // Test email configuration
  testConfig: (data: any) => api.post('/email-config/test', data),
  
  // Get email providers
  getProviders: () => api.get('/email-config/providers'),
  
  // Get SMTP settings
  getSmtpSettings: () => api.get('/email-config/smtp'),
  
  // Update SMTP settings
  updateSmtpSettings: (data: any) => api.put('/email-config/smtp', data),
};

// Email Queue Management
export const emailQueueApi = {
  // Get queue status
  getStatus: () => api.get('/email-queue/status'),
  
  // Get queued emails
  getQueued: (params?: any) => api.get('/email-queue/queued', { params }),
  
  // Get failed emails
  getFailed: (params?: any) => api.get('/email-queue/failed', { params }),
  
  // Retry failed email
  retry: (id: string) => api.post(`/email-queue/retry/${id}`),
  
  // Clear queue
  clearQueue: () => api.delete('/email-queue/clear'),
  
  // Pause queue
  pauseQueue: () => api.post('/email-queue/pause'),
  
  // Resume queue
  resumeQueue: () => api.post('/email-queue/resume'),
};

// Email List Management
export const emailListApi = {
  // Get all email lists
  getAll: (params?: any) => api.get('/email-lists', { params }),
  
  // Get list by ID
  getById: (id: string) => api.get(`/email-lists/${id}`),
  
  // Create list
  create: (data: any) => api.post('/email-lists', data),
  
  // Update list
  update: (id: string, data: any) => api.put(`/email-lists/${id}`, data),
  
  // Delete list
  delete: (id: string) => api.delete(`/email-lists/${id}`),
  
  // Add subscribers to list
  addSubscribers: (id: string, emails: string[]) => api.post(`/email-lists/${id}/subscribers`, { emails }),
  
  // Remove subscribers from list
  removeSubscribers: (id: string, emails: string[]) => api.delete(`/email-lists/${id}/subscribers`, { data: { emails } }),
  
  // Get list subscribers
  getSubscribers: (id: string, params?: any) => api.get(`/email-lists/${id}/subscribers`, { params }),
  
  // Import subscribers from CSV
  importSubscribers: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/email-lists/${id}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  // Export subscribers to CSV
  exportSubscribers: (id: string) => api.get(`/email-lists/${id}/export`, { responseType: 'blob' }),
};

// Email Testing
export const emailTestApi = {
  // Send test email
  sendTest: (data: any) => api.post('/email-test/send', data),
  
  // Send test with template
  sendTestTemplate: (templateId: string, data: any) => api.post(`/email-test/template/${templateId}`, data),
  
  // Validate email template
  validateTemplate: (template: string) => api.post('/email-test/validate', { template }),
  
  // Check email deliverability
  checkDeliverability: (email: string) => api.post('/email-test/deliverability', { email }),
  
  // Preview template with data
  previewTemplate: (templateId: string, data: any) => api.post(`/email-test/preview/${templateId}`, data),
};

// Email Automation
export const emailAutomationApi = {
  // Get all automation rules
  getAll: () => api.get('/email-automation'),
  
  // Get automation rule by ID
  getById: (id: string) => api.get(`/email-automation/${id}`),
  
  // Create automation rule
  create: (data: any) => api.post('/email-automation', data),
  
  // Update automation rule
  update: (id: string, data: any) => api.put(`/email-automation/${id}`, data),
  
  // Delete automation rule
  delete: (id: string) => api.delete(`/email-automation/${id}`),
  
  // Enable automation rule
  enable: (id: string) => api.post(`/email-automation/${id}/enable`),
  
  // Disable automation rule
  disable: (id: string) => api.post(`/email-automation/${id}/disable`),
  
  // Test automation rule
  test: (id: string, data: any) => api.post(`/email-automation/${id}/test`, data),
};

// Email Bounce Management
export const emailBounceApi = {
  // Get bounce list
  getAll: (params?: any) => api.get('/email-bounces', { params }),
  
  // Get bounce by ID
  getById: (id: string) => api.get(`/email-bounces/${id}`),
  
  // Mark bounce as resolved
  resolve: (id: string) => api.post(`/email-bounces/${id}/resolve`),
  
  // Delete bounce record
  delete: (id: string) => api.delete(`/email-bounces/${id}`),
  
  // Bulk resolve bounces
  bulkResolve: (ids: string[]) => api.post('/email-bounces/bulk-resolve', { ids }),
  
  // Get bounce statistics
  getStats: () => api.get('/email-bounces/stats'),
};

// Email Unsubscribe Management
export const emailUnsubscribeApi = {
  // Get unsubscribe list
  getAll: (params?: any) => api.get('/email-unsubscribes', { params }),
  
  // Get unsubscribe by ID
  getById: (id: string) => api.get(`/email-unsubscribes/${id}`),
  
  // Re-subscribe user
  resubscribe: (id: string) => api.post(`/email-unsubscribes/${id}/resubscribe`),
  
  // Delete unsubscribe record
  delete: (id: string) => api.delete(`/email-unsubscribes/${id}`),
  
  // Get unsubscribe statistics
  getStats: () => api.get('/email-unsubscribes/stats'),
  
  // Get unsubscribe reasons
  getReasons: () => api.get('/email-unsubscribes/reasons'),
};
