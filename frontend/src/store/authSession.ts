/** Shared auth session flags — kept separate from authStore to avoid circular imports with api/client. */

let isRestoringSession = false;
let refreshInFlight: Promise<string | null> | null = null;

export function getIsRestoringSession(): boolean {
  return isRestoringSession;
}

export function setIsRestoringSession(value: boolean): void {
  isRestoringSession = value;
}

export function getRefreshInFlight(): Promise<string | null> | null {
  return refreshInFlight;
}

export function setRefreshInFlight(promise: Promise<string | null> | null): void {
  refreshInFlight = promise;
}
