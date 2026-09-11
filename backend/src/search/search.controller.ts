import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  ValidationPipe,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { SearchService, SearchQuery } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { ResponseDto } from '../utils/response.dto';
import { ApiVersion } from '../common/decorators/api-version.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Cache } from '../common/decorators/cache.decorator';
import { ApiVersionGuard } from '../common/guards/api-version.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { CacheInterceptor } from '../common/interceptors/cache.interceptor';

/**
 * Results are confined to the caller's organisation — see
 * SearchService.tenantScopeFor. Saved, recent and popular searches, and
 * facets, were removed: they had no storage behind them and returned invented
 * counts, with saveSearch reporting success while persisting nothing.
 */
@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ApiVersionGuard)
@ApiVersion('v1')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @ApiOperation({ summary: 'Search across bookings, spaces and organisations' })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid search query' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @UseGuards(RateLimitGuard)
  @RateLimit(50, 60000) // 50 requests per minute
  async search(
    @CurrentUser() user: AuthUser,
    @Body(ValidationPipe) searchQuery: SearchQuery,
  ) {
    if (!searchQuery.query || searchQuery.query.trim().length < 2) {
      throw new BadRequestException(
        'Search query must be at least 2 characters long',
      );
    }

    if (searchQuery.pagination) {
      if (searchQuery.pagination.page < 1) {
        throw new BadRequestException('Page must be greater than 0');
      }
      if (
        searchQuery.pagination.limit < 1 ||
        searchQuery.pagination.limit > 100
      ) {
        throw new BadRequestException('Limit must be between 1 and 100');
      }
    }

    const results = await this.searchService.search(user, searchQuery);
    return new ResponseDto('Search completed successfully', results);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions based on query' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Entity type to suggest for',
  })
  @ApiResponse({
    status: 200,
    description: 'Suggestions retrieved successfully',
  })
  @UseInterceptors(CacheInterceptor)
  @Cache(300000) // 5 minutes cache
  @UseGuards(RateLimitGuard)
  @RateLimit(30, 60000) // 30 requests per minute
  async getSuggestions(
    @CurrentUser() user: AuthUser,
    @Query('q') query: string,
    @Query('type') type?: string,
  ) {
    if (!query || query.trim().length < 2) {
      return new ResponseDto('Suggestions retrieved successfully', []);
    }

    const suggestions = await this.searchService.getSuggestions(
      user,
      query.trim(),
      type,
    );
    return new ResponseDto('Suggestions retrieved successfully', suggestions);
  }
}
