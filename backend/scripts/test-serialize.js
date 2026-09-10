const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module');
const { MaintenanceService } = require('../dist/src/maintenance/maintenance.service');
const { PrismaService } = require('../dist/src/prisma/prisma.service');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const user = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const authUser = { id: user.id, role: user.role, tenant_id: user.tenant_id, email: user.email };
  const tickets = await app.get(MaintenanceService).findAllForUser(authUser, {});
  try {
    JSON.stringify(tickets);
    console.log('serialize ok', tickets.length);
  } catch (e) {
    console.error('serialize ERR', e.message);
  }
  await app.close();
}
main();
