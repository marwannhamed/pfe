import type { SpaceLocationValues } from '../components/spaces/SpaceLocationFields';

export function validatePublishLocation(location: SpaceLocationValues): Record<string, string> {
  if (!location.is_published) return {};
  const errors: Record<string, string> = {};
  if (!location.address?.trim()) errors.address = 'Address required to publish';
  if (!location.city?.trim()) errors.city = 'City required to publish';
  if (!location.country?.trim()) errors.country = 'Country required to publish';
  if (!location.map_lat?.trim() || Number.isNaN(Number(location.map_lat))) {
    errors.map_lat = 'Map latitude required';
  }
  if (!location.map_lng?.trim() || Number.isNaN(Number(location.map_lng))) {
    errors.map_lng = 'Map longitude required';
  }
  return errors;
}
