import { useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  loadCrisp,
  setCrispUserSession,
  showCrispWidget,
  hideCrispWidget,
  crispReset,
  getCrispSessionId,
} from '../lib/crisp';
import { userApi } from '../api/services';
import type { User } from '../types';

const TENANT_ROLES = new Set(['TENANT_ADMIN', 'TENANT_EMPLOYEE']);

function tenantMeta(user: User | null): { name: string; plan: string } {
  const t = user?.tenant;
  if (t && typeof t === 'object') {
    return {
      name: 'name' in t ? String((t as { name?: string }).name ?? '') : '',
      plan:
        'subscription_plan' in t
          ? String((t as { subscription_plan?: string }).subscription_plan ?? '')
          : '',
    };
  }
  return { name: '', plan: '' };
}

/**
 * Loads Crisp for tenant portal users only; sets identity + session data for agents.
 */
export function CrispTenantChat() {
  const user = useAuthStore((s) => s.user);
  const websiteId = import.meta.env.VITE_CRISP_WEBSITE_ID as string | undefined;
  const { name: tenantName, plan: tenantPlan } = useMemo(() => tenantMeta(user), [user]);

  useEffect(() => {
    if (!user) {
      crispReset();
      return;
    }
    if (!websiteId || !TENANT_ROLES.has(user.role)) {
      hideCrispWidget();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await loadCrisp(websiteId);
        if (cancelled) return;
        const nickname =
          [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;
        setCrispUserSession({
          email: user.email,
          nickname,
          tenantName: tenantName || 'Tenant',
          role: user.role,
          plan: tenantPlan || '—',
        });
        showCrispWidget();
        getCrispSessionId((sid) => {
          if (!sid || !user.id) return;
          void userApi.update(user.id, { crisp_session_id: sid }).catch(() => undefined);
        });
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    websiteId,
    user?.id,
    user?.role,
    user?.email,
    user?.first_name,
    user?.last_name,
    tenantName,
    tenantPlan,
  ]);

  return null;
}
