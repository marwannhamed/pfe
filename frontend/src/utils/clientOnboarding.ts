import type { User } from '../types';

export type ClientOnboardingStepId = 'profile' | 'space' | 'team';

export interface ClientOnboardingStep {
  id: ClientOnboardingStepId;
  label: string;
  description: string;
  path: string;
  completed: boolean;
}

export function onboardingDismissKey(userId: string): string {
  return `client_onboarding_dismissed_${userId}`;
}

export function isOnboardingDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(onboardingDismissKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export function dismissOnboarding(userId: string): void {
  try {
    localStorage.setItem(onboardingDismissKey(userId), 'true');
  } catch {
    // ignore
  }
}

/** Profile is complete when required fields match ProfilePage validation. */
export function isProfileComplete(user: User | null | undefined): boolean {
  if (!user?.id) return false;
  const phone = user.phone_number?.trim() ?? '';
  return !!(
    user.first_name?.trim() &&
    user.last_name?.trim() &&
    user.email?.trim() &&
    phone &&
    /^\+[1-9]\d{6,14}$/.test(phone)
  );
}

export function buildClientOnboardingSteps(input: {
  profileComplete: boolean;
  spaceCount: number;
  teamMemberCount: number;
}): ClientOnboardingStep[] {
  return [
    {
      id: 'profile',
      label: 'Complete your profile',
      description: 'Add your name, email, and phone number',
      path: '/admin/profile',
      completed: input.profileComplete,
    },
    {
      id: 'space',
      label: 'Add your first space',
      description: 'Publish a listing so tenants can book',
      path: '/admin/spaces',
      completed: input.spaceCount > 0,
    },
    {
      id: 'team',
      label: 'Invite your team',
      description: 'Add managers, finance, maintenance, or reception staff',
      path: '/admin/users',
      completed: input.teamMemberCount > 0,
    },
  ];
}
