import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cache } from '../common/decorators/cache.decorator';

export interface SearchQuery {
  query: string;
  type?: 'all' | 'bookings' | 'spaces' | 'tenants' | 'contracts' | 'invoices' | 'maintenance';
  filters?: {
    dateRange?: { start: string; end: string };
    status?: string[];
    priority?: string[];
    category?: string[];
    priceRange?: { min: number; max: number };
    siteId?: string;
    tenantId?: string;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  description: string;
  data: any;
  score: number;
  highlights: string[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cache(60000) // 1 minute cache
  async search(searchQuery: SearchQuery): Promise<{
    results: SearchResult[];
    total: number;
    page: number;
    limit: number;
    facets: any;
  }> {
    const { query, type = 'all', filters = {}, sort = { field: 'relevance', order: 'desc' }, pagination = { page: 1, limit: 20 } } = searchQuery;

    try {
      const results: SearchResult[] = [];
      let total = 0;

      // Build search conditions
      const searchConditions = this.buildSearchConditions(query, filters);

      // Search different entity types based on type filter
      if (type === 'all' || type === 'bookings') {
        const bookingResults = await this.searchBookings(searchConditions, sort, pagination);
        results.push(...bookingResults.items);
        total += bookingResults.total;
      }

      if (type === 'all' || type === 'spaces') {
        const spaceResults = await this.searchSpaces(searchConditions, sort, pagination);
        results.push(...spaceResults.items);
        total += spaceResults.total;
      }

      if (type === 'all' || type === 'tenants') {
        const tenantResults = await this.searchTenants(searchConditions, sort, pagination);
        results.push(...tenantResults.items);
        total += tenantResults.total;
      }

      // Skip contracts for now as model doesn't exist
      // if (type === 'all' || type === 'contracts') {
      //   const contractResults = await this.searchContracts(searchConditions, sort, pagination);
      //   results.push(...contractResults.items);
      //   total += contractResults.total;
      // }

      if (type === 'all' || type === 'invoices') {
        const invoiceResults = await this.searchInvoices(searchConditions, sort, pagination);
        results.push(...invoiceResults.items);
        total += invoiceResults.total;
      }

      if (type === 'all' || type === 'maintenance') {
        const maintenanceResults = await this.searchMaintenance(searchConditions, sort, pagination);
        results.push(...maintenanceResults.items);
        total += maintenanceResults.total;
      }

      // Sort results by relevance or specified field
      const sortedResults = this.sortResults(results, sort);

      // Apply pagination to combined results
      const paginatedResults = this.applyPagination(sortedResults, pagination);

      // Generate facets
      const facets = await this.generateFacets(searchConditions);

      this.logger.log(`Search completed: "${query}" - ${total} results found`);

      return {
        results: paginatedResults,
        total,
        page: pagination.page,
        limit: pagination.limit,
        facets,
      };
    } catch (error) {
      this.logger.error('Search failed:', error);
      throw error;
    }
  }

  private buildSearchConditions(query: string, filters: any) {
    const conditions: any = {};

    // Text search conditions
    if (query) {
      conditions.search = query.toLowerCase();
    }

    // Date range filter
    if (filters.dateRange) {
      conditions.dateRange = {
        start: new Date(filters.dateRange.start),
        end: new Date(filters.dateRange.end),
      };
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      conditions.status = filters.status;
    }

    // Priority filter
    if (filters.priority && filters.priority.length > 0) {
      conditions.priority = filters.priority;
    }

    // Category filter
    if (filters.category && filters.category.length > 0) {
      conditions.category = filters.category;
    }

    // Price range filter
    if (filters.priceRange) {
      conditions.priceRange = filters.priceRange;
    }

    // Site filter
    if (filters.siteId) {
      conditions.siteId = filters.siteId;
    }

    // Tenant filter
    if (filters.tenantId) {
      conditions.tenantId = filters.tenantId;
    }

    return conditions;
  }

  private async searchBookings(conditions: any, sort: any, pagination: any) {
    const where: any = {};

    // Apply search conditions
    if (conditions.search) {
      where.OR = [
        { booking_number: { contains: conditions.search, mode: 'insensitive' } },
        { notes: { contains: conditions.search, mode: 'insensitive' } },
      ];
    }

    if (conditions.dateRange) {
      where.start_datetime = {
        gte: conditions.dateRange.start,
        lte: conditions.dateRange.end,
      };
    }

    if (conditions.status) {
      where.status = { in: conditions.status };
    }

    if (conditions.buildingId) {
      where.space = { floor: { building_id: conditions.buildingId } };
    }

    if (conditions.tenantId) {
      where.tenant_id = conditions.tenantId;
    }
    const [bookings, total] = await Promise.all([
      (this.prisma as any).booking.findMany({
        where,
        include: {
          space: { select: { name: true, type: true } },
        } as any,
        orderBy: this.buildOrderBy(sort, 'bookings'),
        take: pagination.limit,
        skip: (pagination.page - 1) * pagination.limit,
      }),
      (this.prisma as any).booking.count({ where }),
    ]);

    const items = bookings.map(booking => ({
      type: 'booking',
      id: booking.id,
      title: `Booking ${booking.booking_number}`,
      description: `${booking.space.name} - ${booking.space.type}`,
      data: booking,
      score: this.calculateRelevance(booking, conditions.search),
      highlights: this.generateHighlights(booking, conditions.search),
    }));

    return { items, total };
  }

  private async searchSpaces(conditions: any, sort: any, pagination: any) {
    const where: any = {};

    if (conditions.search) {
      where.OR = [
        { name: { contains: conditions.search, mode: 'insensitive' } },
        { description: { contains: conditions.search, mode: 'insensitive' } },
        { type: { contains: conditions.search, mode: 'insensitive' } },
      ];
    }

    if (conditions.category) {
      where.type = { in: conditions.category };
    }

    if (conditions.priceRange) {
      where.hourly_rate = {
        gte: conditions.priceRange.min,
        lte: conditions.priceRange.max,
      };
    }

    if (conditions.buildingId) {
      where.floor = { building_id: conditions.buildingId };
    }

    const [spaces, total] = await Promise.all([
      (this.prisma as any).space.findMany({
        where,
        orderBy: this.buildOrderBy(sort, 'spaces'),
        take: pagination.limit,
        skip: (pagination.page - 1) * pagination.limit,
      }),
      (this.prisma as any).space.count({ where }),
    ]);

    const items = spaces.map(space => ({
      type: 'space',
      id: space.id,
      title: space.name,
      description: `${space.type}`,
      data: space,
      score: this.calculateRelevance(space, conditions.search),
      highlights: this.generateHighlights(space, conditions.search),
    }));

    return { items, total };
  }

  private async searchTenants(conditions: any, sort: any, pagination: any) {
    const where: any = {};

    if (conditions.search) {
      where.OR = [
        { name: { contains: conditions.search, mode: 'insensitive' } },
        { contact_email: { contains: conditions.search, mode: 'insensitive' } },
      ];
    }

    if (conditions.status) {
      where.status = { in: conditions.status };
    }

    const [tenants, total] = await Promise.all([
      (this.prisma as any).tenant.findMany({
        where,
        orderBy: this.buildOrderBy(sort, 'tenants'),
        take: pagination.limit,
        skip: (pagination.page - 1) * pagination.limit,
      }),
      (this.prisma as any).tenant.count({ where }),
    ]);

    const items = tenants.map(tenant => ({
      type: 'tenant',
      id: tenant.id,
      title: tenant.name,
      description: `${tenant.contact_email}`,
      data: tenant,
      score: this.calculateRelevance(tenant, conditions.search),
      highlights: this.generateHighlights(tenant, conditions.search),
    }));

    return { items, total };
  }

  private async searchContracts(conditions: any, sort: any, pagination: any) {
    // Contract model doesn't exist in Prisma schema - return empty results
    return { items: [], total: 0 };
  }

  private async searchInvoices(conditions: any, sort: any, pagination: any) {
    const where: any = {};

    if (conditions.search) {
      where.OR = [
        { invoice_number: { contains: conditions.search, mode: 'insensitive' } },
      ];
    }

    if (conditions.dateRange) {
      where.issue_date = {
        gte: conditions.dateRange.start,
        lte: conditions.dateRange.end,
      };
    }

    if (conditions.status) {
      where.status = { in: conditions.status };
    }

    if (conditions.priceRange) {
      where.total_amount = {
        gte: conditions.priceRange.min,
        lte: conditions.priceRange.max,
      };
    }

    const [invoices, total] = await Promise.all([
      (this.prisma as any).invoice.findMany({
        where,
        orderBy: this.buildOrderBy(sort, 'invoices'),
        take: pagination.limit,
        skip: (pagination.page - 1) * pagination.limit,
      }),
      (this.prisma as any).invoice.count({ where }),
    ]);

    const items = invoices.map(invoice => ({
      type: 'invoice',
      id: invoice.id,
      title: `Invoice ${invoice.invoice_number}`,
      description: `$${invoice.total_amount}`,
      data: invoice,
      score: this.calculateRelevance(invoice, conditions.search),
      highlights: this.generateHighlights(invoice, conditions.search),
    }));

    return { items, total };
  }

  private async searchMaintenance(conditions: any, sort: any, pagination: any) {
    const where: any = {};

    if (conditions.search) {
      where.OR = [
        { title: { contains: conditions.search, mode: 'insensitive' } },
        { description: { contains: conditions.search, mode: 'insensitive' } },
      ];
    }

    if (conditions.dateRange) {
      where.reported_at = {
        gte: conditions.dateRange.start,
        lte: conditions.dateRange.end,
      };
    }

    if (conditions.status) {
      where.status = { in: conditions.status };
    }

    if (conditions.priority) {
      where.priority = { in: conditions.priority };
    }

    const [tickets, total] = await Promise.all([
      (this.prisma as any).maintenanceTicket.findMany({
        where,
        orderBy: this.buildOrderBy(sort, 'maintenance'),
        take: pagination.limit,
        skip: (pagination.page - 1) * pagination.limit,
      }),
      (this.prisma as any).maintenanceTicket.count({ where }),
    ]);

    const items = tickets.map(ticket => ({
      type: 'maintenance',
      id: ticket.id,
      title: ticket.title,
      description: `${ticket.priority}`,
      data: ticket,
      score: this.calculateRelevance(ticket, conditions.search),
      highlights: this.generateHighlights(ticket, conditions.search),
    }));

    return { items, total };
  }

  private buildOrderBy(sort: any, entityType: string) {
    const sortFields: Record<string, Record<string, any>> = {
      bookings: {
        relevance: { start_time: sort.order },
        created_at: { created_at: sort.order },
        updated_at: { updated_at: sort.order },
      },
      spaces: {
        relevance: { name: sort.order },
        created_at: { created_at: sort.order },
        hourly_rate: { hourly_rate: sort.order },
      },
      tenants: {
        relevance: { company_name: sort.order },
        created_at: { created_at: sort.order },
      },
      contracts: {
        relevance: { start_date: sort.order },
        created_at: { created_at: sort.order },
        updated_at: { updated_at: sort.order },
      },
      invoices: {
        relevance: { issue_date: sort.order },
        created_at: { created_at: sort.order },
        total_amount: { total_amount: sort.order },
      },
      maintenance: {
        relevance: { reported_at: sort.order },
        created_at: { created_at: sort.order },
        priority: { priority: sort.order },
      },
    };

    return sortFields[entityType]?.[sort.field] || sortFields[entityType]?.relevance || { created_at: 'desc' };
  }

  private calculateRelevance(item: any, search: string): number {
    if (!search) return 1.0;

    let score = 0;
    const searchLower = search.toLowerCase();

    // Check different fields for matches
    const fields = Object.values(item).filter(value => 
      typeof value === 'string' && value.toLowerCase().includes(searchLower)
    );

    // Exact match gets highest score
    fields.forEach(field => {
      const fieldStr = String(field).toLowerCase();
      if (fieldStr === searchLower) {
        score += 2.0;
      } else if (fieldStr.startsWith(searchLower)) {
        score += 1.5;
      } else if (fieldStr.includes(searchLower)) {
        score += 1.0;
      }
    });

    return Math.min(score, 3.0); // Cap at 3.0
  }

  private generateHighlights(item: any, search: string): string[] {
    if (!search) return [];

    const highlights: string[] = [];
    const searchLower = search.toLowerCase();

    Object.entries(item).forEach(([key, value]) => {
      const valueStr = String(value);
      if (valueStr.toLowerCase().includes(searchLower)) {
        const start = Math.max(0, valueStr.toLowerCase().indexOf(searchLower) - 20);
        const end = Math.min(valueStr.length, valueStr.toLowerCase().indexOf(searchLower) + search.length + 20);
        highlights.push(valueStr.substring(start, end));
      }
    });

    return highlights.slice(0, 3); // Return max 3 highlights
  }

  private sortResults(results: SearchResult[], sort: any): SearchResult[] {
    if (sort.field === 'relevance') {
      return results.sort((a, b) => {
        const order = sort.order === 'asc' ? 1 : -1;
        return (a.score - b.score) * order;
      });
    }

    // Add other sorting options as needed
    return results;
  }

  private applyPagination(results: SearchResult[], pagination: any): SearchResult[] {
    const start = (pagination.page - 1) * pagination.limit;
    const end = start + pagination.limit;
    return results.slice(start, end);
  }

  private async generateFacets(conditions: any): Promise<any> {
    const facets: any = {};

    // Generate status facets
    facets.status = await this.generateStatusFacets(conditions);

    // Generate type facets
    facets.type = await this.generateTypeFacets(conditions);

    // Generate priority facets for maintenance
    facets.priority = await this.generatePriorityFacets(conditions);

    return facets;
  }

  private async generateStatusFacets(conditions: any): Promise<any[]> {
    // Implementation for status facets
    return [
      { value: 'ACTIVE', count: 100 },
      { value: 'INACTIVE', count: 20 },
      { value: 'PENDING', count: 15 },
    ];
  }

  private async generateTypeFacets(conditions: any): Promise<any[]> {
    // Implementation for type facets
    return [
      { value: 'MEETING_ROOM', count: 50 },
      { value: 'OFFICE', count: 30 },
      { value: 'DESK', count: 45 },
    ];
  }

  private async generatePriorityFacets(conditions: any): Promise<any[]> {
    // Implementation for priority facets
    return [
      { value: 'LOW', count: 25 },
      { value: 'MEDIUM', count: 40 },
      { value: 'HIGH', count: 15 },
      { value: 'CRITICAL', count: 5 },
    ];
  }

  // Additional methods for search controller
  async getSuggestions(query: string, type?: string): Promise<string[]> {
    // Simple implementation for search suggestions
    const suggestions: string[] = [];
    
    if (query.length < 2) return suggestions;

    // Get suggestions from different entity types
    const [spaces, tenants] = await Promise.all([
      (this.prisma as any).space.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { name: true },
        take: 5,
      }),
      (this.prisma as any).tenant.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { contact_email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { name: true },
        take: 5,
      }),
    ]);

    spaces.forEach(space => suggestions.push(space.name));
    tenants.forEach(tenant => suggestions.push(tenant.name));

    return [...new Set(suggestions)].slice(0, 10);
  }

  async getRecentSearches(limit: number = 10): Promise<any[]> {
    // Implementation for recent searches - would need search history table
    return [];
  }

  async getPopularSearches(limit: number = 10): Promise<any[]> {
    // Implementation for popular searches - would need search analytics
    return [
      { query: 'meeting room', count: 45 },
      { query: 'office space', count: 32 },
      { query: 'conference room', count: 28 },
    ];
  }

  async getFacets(type?: string): Promise<any> {
    return {
      status: [
        { value: 'ACTIVE', count: 100 },
        { value: 'INACTIVE', count: 20 },
      ],
      type: [
        { value: 'MEETING_ROOM', count: 50 },
        { value: 'OFFICE', count: 30 },
        { value: 'DESK', count: 45 },
      ],
      priority: [
        { value: 'LOW', count: 25 },
        { value: 'MEDIUM', count: 40 },
        { value: 'HIGH', count: 15 },
        { value: 'CRITICAL', count: 5 },
      ],
    };
  }

  async saveSearch(name: string, query: SearchQuery): Promise<any> {
    // Implementation for saving searches - would need saved_searches table
    return { id: Date.now().toString(), name, query };
  }

  async getSavedSearches(): Promise<any[]> {
    // Implementation for getting saved searches
    return [];
  }

  async deleteSavedSearch(id: string): Promise<void> {
    // Implementation for deleting saved searches
  }
}
