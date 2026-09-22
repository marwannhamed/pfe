import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SpaceFinderService } from './space-finder.service';
import { SpaceFinderDto } from './dto/space-finder.dto';

/**
 * Deliberately its own controller.
 *
 * AiController carries class-level JwtAuthGuard and RolesGuard, and this route
 * has to be reachable without an account — a visitor asking what is available
 * has not signed up yet, and requiring a login to browse would defeat the
 * point. Keeping it separate means the guards on AiController are never
 * loosened to accommodate one public route, which is the kind of change that
 * quietly opens the others.
 *
 * Everything it can reach is already on the public map. See
 * SpaceFinderService.PUBLIC_WHERE.
 */
@ApiTags('AI (public)')
@Controller('public/space-finder')
export class SpaceFinderController {
  constructor(private readonly finder: SpaceFinderService) {}

  @Post()
  // Unauthenticated and backed by a paid model, so it gets a tighter bucket
  // than the global default: a scraper should run out long before the bill does.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Suggest available spaces from a visitor’s description (no account needed)',
  })
  async find(@Body() dto: SpaceFinderDto) {
    return this.finder.find(dto.messages);
  }
}
