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
import { SpaceFeatureService } from './space-feature.service';
import { CreateSpaceFeatureDto } from './dto/create-space-feature.dto';
import { UpdateSpaceFeatureDto } from './dto/update-space-feature.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Space Features')
@Controller('space-features')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SpaceFeatureController {
  constructor(private readonly spaceFeatureService: SpaceFeatureService) {}

  @Get()
  @ApiOperation({ summary: 'List all space features' })
  @ApiQuery({ name: 'spaceId', required: false })
  findAll(@Query('spaceId') spaceId?: string) {
    return this.spaceFeatureService.findAll(spaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one space feature' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.spaceFeatureService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create space feature' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createSpaceFeatureDto: CreateSpaceFeatureDto) {
    return this.spaceFeatureService.create(createSpaceFeatureDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update space feature' })
  @ApiParam({ name: 'id' })
  update(
    @Param('id') id: string,
    @Body() updateSpaceFeatureDto: UpdateSpaceFeatureDto,
  ) {
    return this.spaceFeatureService.update(id, updateSpaceFeatureDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete space feature' })
  @ApiParam({ name: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.spaceFeatureService.remove(id);
  }
}
