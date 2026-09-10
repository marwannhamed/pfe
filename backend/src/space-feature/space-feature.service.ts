import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceFeatureDto } from './dto/create-space-feature.dto';
import { UpdateSpaceFeatureDto } from './dto/update-space-feature.dto';

@Injectable()
export class SpaceFeatureService {
  constructor(private prisma: PrismaService) {}

  async findAll(spaceId?: string) {
    return this.prisma.spaceFeature.findMany({
      where: spaceId ? { space_id: spaceId } : undefined,
      include: {
        space: {
          select: {
            id: true,
            name: true,
            floor: {
              select: {
                building: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.spaceFeature.findUnique({
      where: { id },
      include: {
        space: {
          select: {
            id: true,
            name: true,
            floor: {
              select: {
                building: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async create(createSpaceFeatureDto: CreateSpaceFeatureDto) {
    return (this.prisma as any).spaceFeature.create({
      data: {
        space_id: createSpaceFeatureDto.space_id,
        name: createSpaceFeatureDto.feature_name, // Map to correct field
        description: createSpaceFeatureDto.feature_type, // Map feature_type to description
        quantity: createSpaceFeatureDto.quantity || 1,
      } as any,
      include: {
        space: {
          select: {
            id: true,
            name: true,
            floor: {
              select: {
                building: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, updateSpaceFeatureDto: UpdateSpaceFeatureDto) {
    return (this.prisma as any).spaceFeature.update({
      where: { id },
      data: {
        name: updateSpaceFeatureDto.feature_name, // Map to correct field
        description: updateSpaceFeatureDto.feature_type, // Map feature_type to description
        quantity: updateSpaceFeatureDto.quantity,
      } as any,
      include: {
        space: {
          select: {
            id: true,
            name: true,
            floor: {
              select: {
                building: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string) {
    return this.prisma.spaceFeature.delete({
      where: { id },
    });
  }
}
