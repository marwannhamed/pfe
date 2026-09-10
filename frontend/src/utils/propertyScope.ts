import type { Building } from '../types';

/** Hide auto-created portfolio shell buildings from client pickers. */
export function isPortfolioShellBuilding(b: Pick<Building, 'slug'> & { slug?: string }) {
  return !!b.slug?.startsWith('portfolio-');
}

export function visibleClientBuildings(buildings: Building[]) {
  return buildings.filter((b) => !isPortfolioShellBuilding(b));
}

export function isClientOperatorRole(role?: string | null) {
  return role === 'CLIENT_ADMIN' || role === 'MANAGER';
}
