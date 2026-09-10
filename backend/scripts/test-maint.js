const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.maintenanceTicket
  .findMany({
    include: {
      space: { include: { floor: { include: { building: true } } } },
      user: true,
      createdBy: true,
      assignee: true,
      tenant: true,
    },
    take: 1,
  })
  .then((r) => console.log('ok', r.length))
  .catch((e) => console.error('ERR', e.message))
  .finally(() => p.$disconnect());
