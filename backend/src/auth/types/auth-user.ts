/** Shape of `req.user` after JwtStrategy.validate (password excluded). */
export interface AuthUser {
  id: string;
  tenant_id: string;
  tenant_company_id?: string | null;
  role: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  status?: string;
  must_change_password?: boolean;
  sessionId?: string | null;
}
