// ─── Enums — exact match to Prisma schema ────────────────────────────────────

export type UserRole      = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'MANAGER' | 'FINANCE' | 'MAINTENANCE' | 'RECEPTIONIST' | 'TENANT_ADMIN' | 'TENANT_EMPLOYEE' | 'GUEST';
export type UserStatus    = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
export type TenantStatus  = 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'TRIAL';
export type SiteStatus    = 'ACTIVE' | 'INACTIVE' | 'CLOSED';
export type SpaceType     = 'DEDICATED_OFFICE' | 'FLEXIBLE_DESK' | 'HOT_DESK' | 'MEETING_ROOM' | 'CONFERENCE_ROOM' | 'PHONE_BOOTH' | 'EVENT_SPACE';
export type SpaceStatus   = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
export type BookingStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'PENDING_PHONE_CONFIRMATION'
  | 'AWAITING_PHYSICAL_VISIT'
  | 'DOCUMENTS_PENDING_UPLOAD'
  | 'ACTIVE'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUSED'
  | 'NO_SHOW';

export type BookingDocumentType =
  | 'cr_copy'
  | 'qid_copy'
  | 'trade_license'
  | 'signed_lease_contract'
  | 'payment_proof'
  | 'contract'
  | 'cheque'
  | 'id'
  | 'other';
export type ContractStatus= 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'RENEWED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type InvoiceType   = 'MONTHLY_RENT' | 'USAGE_BASED' | 'DEPOSIT' | 'ADDON_SERVICE' | 'LATE_FEE';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CHECK' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'ONLINE_PAYMENT';
export type TicketStatus  = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type TicketPriority= 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'EMERGENCY';
export type TicketCategory= 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'CLEANING' | 'FURNITURE' | 'IT_EQUIPMENT' | 'OTHER';
export type BillingCycle  = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type AuditAction   = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'REJECT';
export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type NotificationType    = 'BOOKING_CONFIRMATION' | 'BOOKING_REMINDER' | 'INVOICE_ISSUED' | 'INVOICE_OVERDUE' | 'PAYMENT_RECEIVED' | 'TICKET_UPDATED' | 'CONTRACT_EXPIRING';
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS';
export type NotificationPriority= 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ReportType    = 'OCCUPANCY_RATE' | 'REVENUE_BY_SITE' | 'BOOKING_ANALYTICS' | 'PAYMENT_STATUS' | 'MAINTENANCE_SUMMARY' | 'FINANCIAL_SUMMARY';
export type ReportFormat  = 'PDF' | 'CSV' | 'EXCEL' | 'JSON';
export type DiscountType  = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type ContractItemType = 'SPACE' | 'ADDON_SERVICE';
export type DepositRefundStatus = 'PENDING' | 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED' | 'FORFEITED';

// ─── Models — exact field names from Prisma ───────────────────────────────────

export interface Tenant {
  id:                string;
  name:              string;
  slug:              string;
  contact_email:     string;
  status:            TenantStatus;
  subscription_plan: string;
  max_users:         number;
  max_spaces:        number;
  organization_type?: 'CLIENT' | 'RENTER';
  settings?:         Record<string, unknown>;
  /** Json column; the typeform flow stores the uploaded files here. */
  application_documents?: Array<{ kind?: string; url?: string }> | null;
  created_at:        string;
  // relations
  users?:            User[];
  sites?:            Site[];
}

export interface User {
  id:            string;
  tenant_id:     string;
  role:          UserRole;
  email:         string;
  password?:     string; // For creation/update
  first_name:    string | null;
  last_name:     string | null;
  phone_number?: string | null;
  managed_by_id?: string | null;
  must_change_password?: boolean;
  tenant_company_id?:  string | null;
  status:        UserStatus;
  avatar_url?:   string;
  last_login_at?: string;
  crisp_session_id?: string;
  preferences?:  Record<string, unknown>;
  refreshToken?: string; // For auth
  created_at:    string;
  // relations
  tenant?:       Tenant | Pick<Tenant, 'id' | 'name' | 'slug' | 'subscription_plan' | 'status'>;
}

export interface Site {
  id:              string;
  tenant_id:       string;
  name:            string;
  slug?:           string;
  code:            string;
  city:            string;
  country:         string;
  timezone:        string;
  currency:        string;
  status:          SiteStatus;
  manager_user_id?: string;
  opening_hours?:  Record<string, unknown>;
  gmb_location_id?: string | null;
  gmb_account_id?:  string | null;
  created_at:      string;
  // relations
  buildings?:      Building[];
  manager?:        User;
  tenant?:         Tenant;
}

export interface Building {
  id:             string;
  tenant_id:      string;
  name:           string;
  slug?:          string;
  code:           string;
  address?:       string;
  /** Floors this client added and manages. */
  floors_count:   number;
  /** Optional: total floors in the physical building. */
  total_floors_in_building?: number | null;
  total_area_sqm: string;
  year_built?:    number;
  status:         string;
  created_at:     string;
  // relations
  floors?:        Floor[];
  tenant?:        Tenant;
}

export interface Floor {
  id:             string;
  building_id:    string;
  floor_number:   number;
  name:           string;
  area_sqm:       string;
  floor_plan_url?: string;
  status:         string;
  // relations
  spaces?:        Space[];
  building?:      Building;
}

export interface SpaceFeature {
  id:           string;
  space_id:     string;
  name:         string;
  description?: string | null;
  created_at:   string;
}

export interface Space {
  id:                string;
  floor_id:          string;
  name:              string;
  slug?:             string;         // unique key from the API; `code` is derived from it
  code:              string;
  type:              SpaceType;
  capacity:          number;
  area_sqm:          string;         // Decimal as string from Prisma
  status:            SpaceStatus;
  price_per_hour?:   string;
  price_per_day?:    string;
  price_per_month?:  string;
  currency:          string;
  requires_approval: boolean;
  is_listed?: boolean;
  is_published?:     boolean;
  description?:      string | null;
  virtual_tour_url?: string | null;
  created_at:        string;
  photos:            string[];        // Array of photo URLs
  map_x?:             number;         // Map position X
  map_y?:             number;         // Map position Y
  map_w?:             number;         // Map width
  map_h?:             number;         // Map height
  // Street address / geo — returned by every /spaces read path
  address?:              string | null;
  city?:                 string | null;
  state?:                string | null;
  zip?:                  string | null;
  country?:              string | null;
  map_lat?:              number | null;
  map_lng?:              number | null;
  transportation_notes?: string | null;
  // relations
  features?:         SpaceFeature[];
  floor?:            Floor;
  bookingAddOns?:    BookingAddOn[];
  contractItems?:    ContractItem[];
  maintenanceTickets?: MaintenanceTicket[];
}

export interface Booking {
  id:                   string;
  tenant_id:            string;
  space_id:             string;
  created_by_user_id:   string;
  approved_by_user_id?: string;
  booking_number:       string;
  start_datetime:       string;
  end_datetime:         string;
  status:               BookingStatus;
  promotion_code_id?:   string;
  total_price:          string;
  currency:             string;
  attendee_count:       number;
  checked_in_at?:       string;
  checked_out_at?:      string;
  parent_booking_id?:   string;
  created_at:           string;
  receptionist_id?:     string;
  user?:                User;
  receptionist?:        User;
  documents?:           BookingDocument[];
  // relations
  space?:               Space;
  tenant?:              Tenant;
  createdBy?:           User;
  approvedBy?:          User;
  promotionCode?:       PromotionCode;
  parentBooking?:       Booking;
  childBookings?:       Booking[];
  addOns?:              BookingAddOn[];
}

export interface LeaseContract {
  id:                  string;
  tenant_id:           string;
  created_by_user_id:  string;
  contract_number:     string;
  status:              ContractStatus;
  start_date:          string;
  end_date:            string;
  monthly_rent:        string;
  deposit_amount:      string;
  currency:            string;
  payment_due_day:     number;
  auto_renew:          boolean;
  signed_at?:          string;
  document_url?:       string;
  created_at:          string;
  // relations
  tenant?:             Tenant;
  createdBy?:          User;
  items?:              ContractItem[];
  deposit?:            Deposit;
  invoices?:           Invoice[];
}

export interface Invoice {
  id:              string;
  tenant_id:       string;
  contract_id?:    string;
  promotion_code_id?: string;
  invoice_number:  string;
  type:            InvoiceType;
  status:          InvoiceStatus;
  issue_date:      string;
  due_date:        string;
  subtotal:        string;
  tax_rate?:       string;
  tax_amount:      string;
  total_amount:    string;
  currency:        string;
  document_url?:   string;
  notes?:          string;
  crisp_session_id?: string;
  created_at:      string;
  // relations
  tenant?:         Tenant;
  contract?:       LeaseContract;
  promotionCode?:  PromotionCode;
  payments?:       Payment[];
  lines?:          InvoiceLine[];
}

export interface Payment {
  method:              string;
  id:                   string;
  tenant_id:            string;
  invoice_id:           string;
  recorded_by_user_id:  string;
  payment_number:       string;
  payment_method:       PaymentMethod;
  amount:               string;
  currency:             string;
  payment_date:         string;
  status:               PaymentStatus;
  reference_number?:    string;
  cheque_document_url?: string;
  created_at:           string;
  // relations
  tenant?:              Tenant;
  invoice?:             Invoice;
}

export interface MaintenanceTicket {
  id:                   string;
  space_id:             string;
  created_by_user_id:   string;
  assigned_to?:         string;
  ticket_number:        string;
  title:                string;
  category:             TicketCategory;
  priority:             TicketPriority;
  status:               TicketStatus;
  reported_at:          string;
  resolved_at?:         string;
  estimated_hours?:     string;
  cost?:                string;
  crisp_session_id?:    string;
  created_at:           string;
  updated_at:           string;
  // relations
  space?:               Space;
  createdBy?:           User;
  assignedTo?:          User;
}

export interface Notification {
  id:         string;
  user_id:    string;
  type:       NotificationType;
  channel:    NotificationChannel;
  title:      string;
  message:    string;
  is_read:    boolean;
  read_at?:   string;
  priority:   NotificationPriority;
  created_at: string;
}

export interface AuditLog {
  id:            string;
  tenant_id:     string;
  user_id?:      string;
  action:        AuditAction;
  resource_type: string;
  resource_id:   string;
  old_values?:   Record<string, unknown>;
  new_values?:   Record<string, unknown>;
  ip_address?:   string;
  severity:      AuditSeverity;
  created_at:    string;
  user?:         User;
}

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

export interface LoginDto {
  email:    string;
  password: string;
}

export interface RegisterTenantDto {
  company_name:  string;
  slug:          string;
  contact_email: string;
  first_name:    string;
  last_name:     string;
  email:         string;
  password:      string;
}

export interface AuthResponse {
  accessToken:  string;
  refreshToken: string;
  user:         User;
}

// ─── Create DTOs ──────────────────────────────────────────────────────────────

export interface CreateSiteDto {
  tenant_id:       string;
  name:            string;
  code:            string;
  city:            string;
  country:         string;
  timezone?:       string;
  currency?:       string;
  manager_user_id?: string;
}

export interface CreateSpaceDto {
  floor_id:          string;
  name:              string;
  code:              string;
  type:              SpaceType;
  capacity:          number;
  area_sqm:          number;
  price_per_hour?:   number;
  price_per_day?:    number;
  price_per_month?:  number;
  currency?:         string;
  requires_approval?: boolean;
}

export interface CreateBookingDto {
  tenant_id:          string;
  space_id:           string;
  created_by_user_id: string;
  start_datetime:     string;
  end_datetime:       string;
  total_price:        number;
  currency?:          string;
  attendee_count?:    number;
  status?:            BookingStatus;
}

export interface CreateUserDto {
  tenant_id:  string;
  email:      string;
  password:   string;
  first_name: string;
  last_name:  string;
  role?:      UserRole;
}

export interface CreateMaintenanceTicketDto {
  space_id:           string;
  created_by_user_id: string;
  title:              string;
  category:           TicketCategory;
  priority?:          TicketPriority;
  description?:       string;
}

// ─── Additional Models (Backend-only features now exposed) ────────────────

export interface AddOnService {
  id:            string;
  description?:  string | null;
  site_id:       string;
  name:          string;
  category:      string;
  price:         string;
  currency:      string;
  billing_cycle: BillingCycle;
  is_recurring:  boolean;
  is_active:     boolean;
  created_at:    string;
  // relations
  site?:         Site;
  bookingAddOns?: BookingAddOn[];
  contractItems?: ContractItem[];
}

export interface PromotionCode {
  id:             string;
  /** Owning client organisation — codes never cross tenants. */
  tenant_id:      string;
  code:           string;
  description?:   string | null;
  type:           DiscountType;
  /** Percent (0-100) when type is PERCENTAGE, otherwise an amount. */
  discount:       number;
  max_uses?:      number | null;
  used_count:     number;
  valid_from?:    string | null;
  valid_until?:   string | null;
  is_active:      boolean;
  created_at:     string;
  updated_at:     string;
  // relations
  invoices?:      Invoice[];
}

export interface BookingDocument {
  id:             string;
  booking_id:     string;
  file_url:       string;
  file_name:      string;
  document_type:  BookingDocumentType;
  uploaded_by:    string;
  uploaded_at:    string;
  uploadedBy?:    User;
}

export interface BookingAddOn {
  id:               string;
  booking_id:       string;
  addon_service_id: string;
  quantity:         number;
  unit_price:       string;
  total_price:      string;
  // relations
  addonService?:    AddOnService;
  booking?:         Booking;
}

export interface ContractItem {
  id:               string;
  contract_id:      string;
  item_type:        ContractItemType;
  space_id?:        string;
  addon_service_id?: string;
  description?:     string;
  quantity:         number;
  unit_price:       string;
  currency:         string;
  // relations
  addonService?:    AddOnService;
  contract?:        LeaseContract;
  space?:           Space;
}

export interface Deposit {
  id:              string;
  contract_id:     string;
  amount:          string;
  currency:        string;
  paid_at?:        string;
  refund_status:   DepositRefundStatus;
  refunded_amount?: string;
  refunded_at?:    string;
  notes?:          string;
  // relations
  contract?:       LeaseContract;
}

export interface InvoiceLine {
  id:          string;
  invoice_id:  string;
  description: string;
  quantity:    string;
  unit_price:  string;
  tax_rate:    string;
  line_total:  string;
  // relations
  invoice?:    Invoice;
}

export interface Report {
  id:                   string;
  generated_by_user_id: string;
  report_type:          ReportType;
  title:                string;
  parameters?:          Record<string, unknown>;
  format:               ReportFormat;
  file_url?:            string;
  generated_at:         string;
  // relations
  generatedBy?:         User;
}

// ─── Email Management Types ────────────────────────────────────────────────

export interface EmailTemplate {
  name: string;
  subject: string;
  template: string;
  variables: string[];
}

export interface EmailTestRequest {
  template: string;
  to: string;
  data: Record<string, unknown>;
}

export interface EmailPreview {
  html: string;
  subject: string;
}

// ─── Analytics Types ───────────────────────────────────────────────────────

/**
 * GET /analytics/overview. Each headline figure comes back as a small object
 * comparing the selected window with the one before it. The previous shape
 * declared here (totalRevenue/totalBookings/activeSpaces) was never what the
 * endpoint sends.
 */
export interface AnalyticsTrendValue {
  current: number;
  previous: number;
  change: number;
}

export interface AnalyticsOverview {
  revenue: AnalyticsTrendValue;
  bookings: AnalyticsTrendValue & { confirmed: number };
  invoices: AnalyticsTrendValue & { overdue: number };
  occupancyRate: {
    current: number;
    total: number;
    occupied: number;
    available: number;
  };
  activeTenants: number;
  maintenanceTickets: AnalyticsTrendValue & { open: number };
}

/** GET /analytics/revenue-trend — one point per month. */
export interface RevenueTrend {
  month: string;
  revenue: number;
}

/** GET /analytics/bookings-trend — one point per day. */
export interface BookingsTrend {
  date: string;
  bookings: number;
}

export interface BookingStatusData {
  status: BookingStatus;
  count: number;
  percentage: number;
}

/** GET /analytics/space-utilization — aggregated per space type, not per space. */
export interface SpaceUtilization {
  type: string;
  total: number;
  occupied: number;
  available: number;
  maintenance: number;
  rate: number;
}

export interface MaintenanceStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

/** GET /analytics/top-spaces — grouped by space name, not by id. */
export interface TopSpace {
  name: string;
  type: string;
  count: number;
  revenue: number;
  currency: string;
}

/** GET /analytics/revenue-by-tenant — organisation name and its paid total. */
export interface RevenueByTenant {
  name: string;
  revenue: number;
}

/** GET /billing/invoices/summary */
export interface InvoiceSummary {
  total_invoiced: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  invoice_count: number;
}

/** GET /notifications/stats */
export interface NotificationStats {
  total: number;
  unread: number;
  byType: Array<{ type: string; count: number }>;
}

/** GET /analytics/maintenance — note this is a different shape to MaintenanceStats. */
export interface AnalyticsMaintenance {
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  total: number;
  avgResolutionHours: number;
}

/**
 * What a failed API call actually looks like here: an axios error carrying the
 * server's ResponseDto body, plus the `userMessage` our interceptor attaches.
 * Error handlers used to take `any` purely to reach these fields.
 */
export interface ApiError extends Error {
  response?: {
    status?: number;
    data?: {
      message?: string | string[];
      error?: string;
      statusCode?: number;
    };
  };
  request?: unknown;
  code?: string;
  userMessage?: string;
}

/**
 * What recharts hands a custom <Tooltip content={...}> component. Declared
 * here because five dashboards each define their own tooltip and each was
 * typing the whole props bag `any` to reach payload[].
 */
export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    name?: string | number;
    value?: string | number;
    color?: string;
    dataKey?: string | number;
    payload?: Record<string, unknown>;
  }>;
}

/** GET /tenant-applications — a prospective renter's application to a landlord. */
export interface TenantApplication {
  id:                    string;
  landlord_tenant_id:    string;
  space_id?:             string | null;
  status:                string;
  typeform_response_id?: string | null;
  applicant_tenant_id?:  string | null;
  contact_email?:        string | null;
  company_name?:         string | null;
  created_at:            string;
  updated_at:            string;
  // relations
  landlord_tenant?:      Tenant;
  applicant_tenant?:     Tenant;
  space?:                Space;
}

/** GET /analytics/revenue-forecast */
export interface RevenueForecast {
  generatedAt: string;
  horizonMonths: number;
  summary: {
    activeMonthlyRecurring: number;
    expiringNext90DaysContracts: number;
  };
  monthly: Array<{ month: string; activeMrr: number; expiringMrr: number }>;
  expiringSoon: Array<{
    id: string;
    contract_number: string;
    end_date: string;
    monthly_rent: number;
    status: ContractStatus;
  }>;
}

/**
 * Usage figures for a promotion code. There is no endpoint behind this yet —
 * PromotionCodesPage fills it with a placeholder — so the fields are the ones
 * that screen renders.
 */
export interface PromotionCodeStats {
  totalUses: number;
  totalSavings: number;
  averageSavings?: number;
  lastUsed?: string | null;
}

/** GET /analytics/predictive-maintenance */
export interface PredictiveMaintenanceTicket {
  ticketId: string;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  space_id: string;
  riskScore: number;
  band: 'high' | 'watch' | 'normal';
  hints: string[];
}
