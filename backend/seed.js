const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const PASSWORD = 'Password123!';

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const landlord = await prisma.tenant.upsert({
    where: { slug: 'system' },
    update: {},
    create: {
      name: 'LeaseManager Platform',
      slug: 'system',
      contact_email: 'system@leasemanager.com',
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@leasemanager.com' },
    update: { password: hash, role: 'SUPER_ADMIN', status: 'ACTIVE' },
    create: {
      tenant_id: landlord.id,
      email: 'admin@leasemanager.com',
      password: hash,
      first_name: 'Super',
      last_name: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('Seed OK — admin@leasemanager.com /', PASSWORD);
}

main().catch(console.error).finally(() => prisma.$disconnect());
