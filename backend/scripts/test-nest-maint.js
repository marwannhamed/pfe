const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module');
const { MaintenanceService } = require('../dist/src/maintenance/maintenance.service');
const { TenantApplicationService } = require('../dist/src/forms/tenant-application.service');
const { PrismaService } = require('../dist/src/prisma/prisma.service');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const user = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const authUser = { id: user.id, role: user.role, tenant_id: user.tenant_id, email: user.email };

  try {
    const tickets = await app.get(MaintenanceService).findAllForUser(authUser, {});
    console.log('maintenance ok', tickets.length);
  } catch (e) {
    console.error('maintenance ERR', e.message);
    console.error(e.stack);
  }

  try {
    const pending = await app.get(TenantApplicationService).listPending(authUser);
    console.log('tenant-apps ok', pending.length);
  } catch (e) {
    console.error('tenant-apps ERR', e.message);
    console.error(e.stack);
  }

  await app.close();
}

main();
