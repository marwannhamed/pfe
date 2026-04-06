// ─── Enums — exact match to Prisma schema ────────────────────────────────────

export type UserRole      = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'SITE_MANAGER' | 'FINANCE' | 'EMPLOYEE' | 'MAINTENANCE' | 'GUEST';
export type UserStatus    = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
export type TenantStatus  = 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'TRIAL';
export type SiteStatus    = 'ACTIVE' | 'INACTIVE' | 'CLOSED';
export type SpaceType     = 'DEDICATED_OFFICE' | 'FLEXIBLE_DESK' | 'HOT_DESK' | 'MEETING_ROOM' | 'CONFERENCE_ROOM' | 'PHONE_BOOTH' | 'EVENT_SPACE';
export type SpaceStatus   = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
export type BookingStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
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
  settings?:         Record<string, unknown>;
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
  first_name:    string;
  last_name:     string;
  status:        UserStatus;
  last_login_at?: string;
  preferences?:  Record<string, unknown>;
  created_at:    string;
  // relations
  tenant?:       Tenant;
}

export interface Site {
  id:              string;
  tenant_id:       string;
  name:            string;
  code:            string;
  city:            string;
  country:         string;
  timezone:        string;
  currency:        string;
  status:          SiteStatus;
  manager_user_id?: string;
  opening_hours?:  Record<string, unknown>;
  created_at:      string;
  // relations
  buildings?:      Building[];
  manager?:        User;
  tenant?:         Tenant;
}

export interface Building {
  id:             string;
  site_id:        string;
  name:           string;
  code:           string;
  floors_count:   number;
  total_area_sqm: string;
  year_built?:    number;
  status:         string;
  created_at:     string;
  // relations
  floors?:        Floor[];
  site?:          Site;
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
  feature_type: string;
  feature_name: string;
  quantity:     number;
  is_available: boolean;
}

export interface Space {
  id:                string;
  floor_id:          string;
  name:              string;
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
  created_at:        string;
  // relations
  features?:         SpaceFeature[];
  floor?:            Floor;
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
  price_plan_id?:       string;
  promotion_code_id?:   string;
  total_price:          string;
  currency:             string;
  attendee_count:       number;
  checked_in_at?:       string;
  checked_out_at?:      string;
  created_at:           string;
  // relations
  space?:               Space;
  createdBy?:           User;
  approvedBy?:          User;
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
  created_at:          string;
  // relations
  tenant?:             Tenant;
  createdBy?:          User;
}

export interface Invoice {
  id:              string;
  tenant_id:       string;
  contract_id?:    string;
  invoice_number:  string;
  type:            InvoiceType;
  status:          InvoiceStatus;
  issue_date:      string;
  due_date:        string;
  subtotal:        string;
  tax_amount:      string;
  total_amount:    string;
  currency:        string;
  notes?:          string;
  created_at:      string;
  // relations
  tenant?:         Tenant;
  payments?:       Payment[];
}

export interface Payment {
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
  created_at:           string;
}

export interface MaintenanceTicket {
  id:                   string;
  space_id:             string;
  created_by_user_id:   string;
  assigned_to_user_id?: string;
  ticket_number:        string;
  title:                string;
  category:             TicketCategory;
  priority:             TicketPriority;
  status:               TicketStatus;
  reported_at:          string;
  resolved_at?:         string;
  estimated_hours?:     string;
  cost?:                string;
  created_at:           string;
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

export interface PricePlan {
  id:            string;
  site_id:       string;
  name:          string;
  space_type:    SpaceType;
  billing_cycle: BillingCycle;
  price:         string;
  currency:      string;
  tax_rate:      string;
  is_active:     boolean;
  valid_from:    string;
  valid_to?:     string;
  created_at:    string;
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
  price_plan_id?:     string;
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
}
