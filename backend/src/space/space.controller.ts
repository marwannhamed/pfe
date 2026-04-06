import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SpaceService } from './space.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Spaces')
@Controller('spaces')
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  // ── PUBLIC endpoints (no JWT needed — guests can browse) ─────────────────

  @Get()
  @ApiOperation({ summary: 'List all spaces — public' })
  @ApiQuery({ name: 'floorId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @Query('floorId') floorId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.spaceService.findAll(floorId, type, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one space — public' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.spaceService.findOne(id);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Check availability — public' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'start', required: true })
  @ApiQuery({ name: 'end', required: true })
  isAvailable(
    @Param('id') id: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.spaceService.isAvailable(id, start, end);
  }

  // ── PROTECTED endpoints (JWT required) ───────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a space' })
  create(@Body() dto: CreateSpaceDto) {
    return this.spaceService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a space' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateSpaceDto) {
    return this.spaceService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a space' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.spaceService.remove(id);
  }
}
