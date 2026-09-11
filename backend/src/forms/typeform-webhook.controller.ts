import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { TypeformWebhookService } from './typeform-webhook.service';

@ApiTags('Typeform webhooks')
@Controller('webhooks/typeform')
export class TypeformWebhookController {
  constructor(private readonly webhooks: TypeformWebhookService) {}

  @Post('application')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Typeform form_response — create pending tenant, attach answers/files, notify managers',
  })
  async application(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('typeform-signature') signature: string | undefined,
  ) {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException(
        'Raw request body is required for Typeform signature verification (enable rawBody on NestFactory)',
      );
    }
    this.webhooks.verifySignature(raw, signature);
    const body = JSON.parse(raw.toString('utf8'));
    return this.webhooks.handlePayload(body);
  }
}
