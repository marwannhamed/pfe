import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MarketplaceListingPayload = {
  externalSpaceId: string;
  name: string;
  description: string | null;
  photos: string[];
  pricing: {
    hourly: number | null;
    daily: number | null;
    monthly: number | null;
    currency: string;
  };
  amenities: string[];
  capacity: number | null;
  availability: { start: string; end: string }[];
  type: string;
};

/**
 * HTTP clients for Coworker.com and LiquidSpace–style listing APIs.
 * Configure base URLs + tokens in env; payloads follow a generic JSON contract
 * (adjust paths/bodies to match vendor docs in production).
 */
@Injectable()
export class MarketplaceAdaptersService {
  private readonly logger = new Logger(MarketplaceAdaptersService.name);

  constructor(private readonly config: ConfigService) {}

  private coworkerBase(): string | undefined {
    return this.config.get<string>('COWORKER_API_BASE_URL')?.replace(/\/$/, '');
  }
  private coworkerToken(): string | undefined {
    return this.config.get<string>('COWORKER_API_TOKEN')?.trim();
  }
  private liquidspaceBase(): string | undefined {
    return this.config
      .get<string>('LIQUIDSPACE_API_BASE_URL')
      ?.replace(/\/$/, '');
  }
  private liquidspaceToken(): string | undefined {
    return this.config.get<string>('LIQUIDSPACE_API_TOKEN')?.trim();
  }

  async upsertCoworkerListing(
    listingId: string | null,
    payload: MarketplaceListingPayload,
  ): Promise<string | null> {
    const base = this.coworkerBase();
    const token = this.coworkerToken();
    if (!base || !token) {
      this.logger.debug('Coworker API not configured — skipping push');
      return listingId;
    }
    const path = listingId
      ? `${base}/v1/listings/${listingId}`
      : `${base}/v1/listings`;
    const method = listingId ? 'PUT' : 'POST';
    const res = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ listing: payload }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.warn(
        `Coworker ${method} failed ${res.status}: ${t.slice(0, 200)}`,
      );
      return listingId;
    }
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      listing_id?: string;
    };
    return (json.id ?? json.listing_id ?? listingId) as string | null;
  }

  async deleteCoworkerListing(listingId: string): Promise<void> {
    const base = this.coworkerBase();
    const token = this.coworkerToken();
    if (!base || !token || !listingId) return;
    const res = await fetch(`${base}/v1/listings/${listingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      this.logger.warn(`Coworker DELETE failed ${res.status}`);
    }
  }

  async upsertLiquidspaceListing(
    listingId: string | null,
    payload: MarketplaceListingPayload,
  ): Promise<string | null> {
    const base = this.liquidspaceBase();
    const token = this.liquidspaceToken();
    if (!base || !token) {
      this.logger.debug('LiquidSpace API not configured — skipping push');
      return listingId;
    }
    const path = listingId
      ? `${base}/api/v2/spaces/${listingId}`
      : `${base}/api/v2/spaces`;
    const method = listingId ? 'PATCH' : 'POST';
    const res = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.warn(
        `LiquidSpace ${method} failed ${res.status}: ${t.slice(0, 200)}`,
      );
      return listingId;
    }
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      space_id?: string;
    };
    return (json.id ?? json.space_id ?? listingId) as string | null;
  }

  async deleteLiquidspaceListing(listingId: string): Promise<void> {
    const base = this.liquidspaceBase();
    const token = this.liquidspaceToken();
    if (!base || !token || !listingId) return;
    const res = await fetch(`${base}/api/v2/spaces/${listingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      this.logger.warn(`LiquidSpace DELETE failed ${res.status}`);
    }
  }
}
