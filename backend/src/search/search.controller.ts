import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
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
import { ResponseDto } from '../utils/response.dto';
import { ApiVersion } from '../common/decorators/api-version.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Cache } from '../common/decorators/cache.decorator';
import { ApiVersionGuard } from '../common/guards/api-version.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { CacheInterceptor } from '../common/interceptors/cache.interceptor';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ApiVersionGuard)
@ApiVersion('v1')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @ApiOperation({ summary: 'Advanced search across all entities' })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid search query' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @UseInterceptors(CacheInterceptor)
  @Cache(60000) // 1 minute cache
  @UseGuards(RateLimitGuard)
  @RateLimit(50, 60000) // 50 requests per minute
  async search(@Body(ValidationPipe) searchQuery: SearchQuery) {
    try {
      // Validate search query
      if (!searchQuery.query || searchQuery.query.trim().length < 2) {
        throw new BadRequestException(
          'Search query must be at least 2 characters long',
        );
      }

      // Validate pagination
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

      const results = await this.searchService.search(searchQuery);
      return new ResponseDto('Search completed successfully', results);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
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
    @Query('q') query: string,
    @Query('type') type?: string,
  ) {
    try {
      if (!query || query.trim().length < 2) {
        return new ResponseDto('Suggestions retrieved successfully', []);
      }

      const suggestions = await this.searchService.getSuggestions(
        query.trim(),
        type,
      );
      return new ResponseDto('Suggestions retrieved successfully', suggestions);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent searches for current user' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of recent searches to return',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Recent searches retrieved successfully',
  })
  @UseInterceptors(CacheInterceptor)
  @Cache(60000) // 1 minute cache
  async getRecentSearches(@Query('limit') limit: number = 10) {
    try {
      const recentSearches = await this.searchService.getRecentSearches(limit);
      return new ResponseDto(
        'Recent searches retrieved successfully',
        recentSearches,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular searches across all users' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of popular searches to return',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Popular searches retrieved successfully',
  })
  @UseInterceptors(CacheInterceptor)
  @Cache(300000) // 5 minutes cache
  async getPopularSearches(@Query('limit') limit: number = 10) {
    try {
      const popularSearches =
        await this.searchService.getPopularSearches(limit);
      return new ResponseDto(
        'Popular searches retrieved successfully',
        popularSearches,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('facets')
  @ApiOperation({ summary: 'Get search facets for filtering' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Entity type to get facets for',
  })
  @ApiResponse({ status: 200, description: 'Facets retrieved successfully' })
  @UseInterceptors(CacheInterceptor)
  @Cache(600000) // 10 minutes cache
  async getFacets(@Query('type') type?: string) {
    try {
      const facets = await this.searchService.getFacets(type);
      return new ResponseDto('Facets retrieved successfully', facets);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('save')
  @ApiOperation({ summary: 'Save a search query for quick access' })
  @ApiResponse({ status: 201, description: 'Search saved successfully' })
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60000) // 10 requests per minute
  async saveSearch(
    @Body() saveSearchDto: { name: string; query: SearchQuery },
  ) {
    try {
      const savedSearch = await this.searchService.saveSearch(
        saveSearchDto.name,
        saveSearchDto.query,
      );
      return new ResponseDto('Search saved successfully', savedSearch);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('saved')
  @ApiOperation({ summary: 'Get saved searches for current user' })
  @ApiResponse({
    status: 200,
    description: 'Saved searches retrieved successfully',
  })
  async getSavedSearches() {
    try {
      const savedSearches = await this.searchService.getSavedSearches();
      return new ResponseDto(
        'Saved searches retrieved successfully',
        savedSearches,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete('saved/:id')
  @ApiOperation({ summary: 'Delete a saved search' })
  @ApiResponse({
    status: 200,
    description: 'Saved search deleted successfully',
  })
  @UseGuards(RateLimitGuard)
  @RateLimit(20, 60000) // 20 requests per minute
  async deleteSavedSearch(@Param('id') id: string) {
    try {
      await this.searchService.deleteSavedSearch(id);
      return new ResponseDto('Saved search deleted successfully', null);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
