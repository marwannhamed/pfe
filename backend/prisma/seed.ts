import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Password123!', 10);

  // Required because tenant_id is mandatory for all users
  const systemTenant = await prisma.tenant.upsert({
    where:  { slug: 'system' },
    update: {},
    create: {
      name:              'LeaseManager Platform',
      slug:              'system',
      contact_email:     'system@leasemanager.com',
      subscription_plan: 'enterprise',
      status:            'ACTIVE',
      max_users:         999,
      max_spaces:        999,
    },
  });

  await prisma.user.upsert({
    where:  { email: 'admin@leasemanager.com' },
    update: {},
    create: {
      tenant_id:  systemTenant.id,
      email:      'admin@leasemanager.com',
      password:   hash,
      first_name: 'Super',
      last_name:  'Admin',
      role:       'SUPER_ADMIN',
      status:     'ACTIVE',
    },
  });

  console.log('✅ Super Admin ready!');
  console.log('   Email:    admin@leasemanager.com');
  console.log('   Password: Password123!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());