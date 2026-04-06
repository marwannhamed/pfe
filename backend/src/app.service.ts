import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Office Lease Management API is running! 🚀';
  }
}
