import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { spaceApi, userApi } from '../api/services';
import { useAuthStore } from '../store/authStore';
import {
  buildClientOnboardingSteps,
  dismissOnboarding,
  isOnboardingDismissed,
  isProfileComplete,
} from '../utils/clientOnboarding';
import { isClientTeamRole } from '../constants/team';

function toArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as { data?: T[] })?.data)) return (raw as { data: T[] }).data;
  return [];
}

const ONBOARDING_ROLES = new Set(['CLIENT_ADMIN', 'MANAGER']);

export function useClientOnboarding() {
  const { user } = useAuthStore();
  const role = user?.role ?? '';
  const enabled = ONBOARDING_ROLES.has(role) && !!user?.id;
  const [dismissed, setDismissed] = useState(() =>
    user?.id ? isOnboardingDismissed(user.id) : false,
  );

  useEffect(() => {
    if (user?.id) setDismissed(isOnboardingDismissed(user.id));
  }, [user?.id]);

  const { data: spacesRaw, isLoading: spacesLoading } = useQuery({
    queryKey: ['client-onboarding-spaces'],
    queryFn: () => spaceApi.getAll(),
    enabled: enabled && !!user?.id,
  });

  const { data: teamRaw, isLoading: teamLoading } = useQuery({
    queryKey: ['client-onboarding-team', user?.tenant_id],
    queryFn: () => userApi.getAll(user!.tenant_id),
    enabled: enabled && !!user?.tenant_id,
  });

  const spaces = toArray<any>(spacesRaw);
  const teamMembers = toArray<{ id: string; role: string }>(teamRaw).filter(
    (u) => u.id !== user?.id && isClientTeamRole(u.role),
  );

  const steps = useMemo(
    () =>
      buildClientOnboardingSteps({
        profileComplete: isProfileComplete(user),
        spaceCount: spaces.length,
        teamMemberCount: teamMembers.length,
      }),
    [user, spaces.length, teamMembers.length],
  );

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const allComplete = completedCount === totalCount;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (enabled && user?.id && allComplete && !dismissed) {
      dismissOnboarding(user.id);
      setDismissed(true);
    }
  }, [allComplete, dismissed, enabled, user?.id]);

  const dismiss = () => {
    if (!user?.id) return;
    dismissOnboarding(user.id);
    setDismissed(true);
  };

  return {
    enabled,
    steps,
    completedCount,
    totalCount,
    allComplete,
    progressPct,
    isLoading: spacesLoading || teamLoading,
    visible: enabled && !dismissed && !allComplete,
    dismiss,
  };
}
