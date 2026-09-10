const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.tenantApplication
  .findMany({
    where: {
      status: 'SUBMITTED',
      applicant_tenant_id: { not: null },
      applicant_tenant: { status: 'PENDING' },
    },
    include: {
      applicant_tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          contact_email: true,
          status: true,
          application_profile: true,
          application_documents: true,
          created_at: true,
        },
      },
      space: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          floor: {
            select: {
              building: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
    },
    take: 1,
  })
  .then((r) => console.log('ok', r.length))
  .catch((e) => console.error('ERR', e.message))
  .finally(() => p.$disconnect());
