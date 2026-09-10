import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { TenantApplicationService } from '../src/forms/tenant-application.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const user = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!user) throw new Error('no super admin');
  const authUser = { id: user.id, role: user.role, tenant_id: user.tenant_id, email: user.email };

  try {
    const maint = app.get(MaintenanceService);
    const tickets = await maint.findAllForUser(authUser as any, {});
    console.log('maintenance ok', tickets.length);
  } catch (e) {
    console.error('maintenance ERR', (e as Error).message);
    console.error((e as Error).stack);
  }

  try {
    const apps = app.get(TenantApplicationService);
    const pending = await apps.listPending(authUser as any);
    console.log('tenant-apps ok', pending.length);
  } catch (e) {
    console.error('tenant-apps ERR', (e as Error).message);
    console.error((e as Error).stack);
  }

  await app.close();
}

main();
