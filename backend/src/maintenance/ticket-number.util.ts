import { randomUUID } from 'crypto';

export function generateMaintenanceTicketNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = randomUUID().split('-')[0].toUpperCase();
  return `TK-${year}${month}${day}-${random}`;
}
