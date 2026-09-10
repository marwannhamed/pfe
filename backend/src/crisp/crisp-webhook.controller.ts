import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CrispWebhookService } from './crisp-webhook.service';

@ApiTags('Crisp webhooks')
@Controller('webhooks/crisp')
export class CrispWebhookController {
  constructor(private readonly crispWebhooks: CrispWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Crisp HTTP callback (conversation closed, tags, etc.)',
    description:
      'Verifies X-Crisp-Signature over raw body + X-Crisp-Request-Timestamp. When a session settles with tag `maintenance-request`, creates a maintenance ticket.',
  })
  handle(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-crisp-signature') signature: string | undefined,
    @Headers('x-crisp-request-timestamp') timestamp: string | undefined,
  ) {
    const raw =
      req.rawBody != null
        ? req.rawBody.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body ?? {});

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('Invalid JSON body');
    }

    try {
      this.crispWebhooks.verifySignature(raw, timestamp, signature);
    } catch (e) {
      throw e;
    }

    return this.crispWebhooks.handleEvent(raw, payload);
  }
}
