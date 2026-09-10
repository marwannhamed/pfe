import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketplaceWebhookService } from './marketplace-webhook.service';
import { MarketplaceInquiryDto } from './dto/marketplace-inquiry.dto';

@ApiTags('Marketplace webhooks')
@Controller('webhooks/marketplace')
export class MarketplaceWebhookController {
  constructor(private readonly webhooks: MarketplaceWebhookService) {}

  @Post('coworker')
  @ApiOperation({
    summary: 'Coworker.com booking inquiry — creates PENDING_APPROVAL booking',
    description:
      'Sign payload: hex(HMAC_SHA256(secret, inquiryId|start|end|spaceId|listingId)). Header: X-Marketplace-Signature',
  })
  coworker(
    @Headers('x-marketplace-signature') signature: string | undefined,
    @Body() body: MarketplaceInquiryDto,
  ) {
    return this.webhooks.handleInquiry('coworker', signature, body);
  }

  @Post('liquidspace')
  @ApiOperation({
    summary: 'LiquidSpace booking inquiry — creates PENDING_APPROVAL booking',
  })
  liquidspace(
    @Headers('x-marketplace-signature') signature: string | undefined,
    @Body() body: MarketplaceInquiryDto,
  ) {
    return this.webhooks.handleInquiry('liquidspace', signature, body);
  }
}
