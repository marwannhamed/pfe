import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PASSWORD = 'Password123!';

async function seedMinimal(hash: string) {
  const landlord = await prisma.tenant.upsert({
    where: { slug: 'system' },
    update: {},
    create: {
      name: 'LeaseManager Platform',
      slug: 'system',
      contact_email: 'system@leasemanager.com',
      subscription_plan: 'enterprise',
      status: 'ACTIVE',
      max_users: 999,
      max_spaces: 999,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@leasemanager.com' },
    update: {
      password: hash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      tenant_id: landlord.id,
      first_name: 'Super',
      last_name: 'Admin',
    },
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

  console.log('\n  Database reset — super admin only');
  console.log('  Login: admin@leasemanager.com / Password123!\n');
}

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  if (process.env.SEED_MINIMAL === '1') {
    await seedMinimal(hash);
    return;
  }

  // ── Landlord org (property manager) ─────────────────────────────────────────
  const landlord = await prisma.tenant.upsert({
    where: { slug: 'system' },
    update: {},
    create: {
      name: 'LeaseManager Platform',
      slug: 'system',
      contact_email: 'system@leasemanager.com',
      subscription_plan: 'enterprise',
      status: 'ACTIVE',
      max_users: 999,
      max_spaces: 999,
    },
  });

  // ── Customer org (renter company — Level 3) ───────────────────────────────────
  const customerTenant = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: { organization_type: 'RENTER' },
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      contact_email: 'contact@acme-corp.test',
      subscription_plan: 'professional',
      status: 'ACTIVE',
      organization_type: 'RENTER',
      max_users: 25,
      max_spaces: 10,
    },
  });

  // ── Demo client org (property manager — Level 2) ─────────────────────────────
  const demoClient = await prisma.tenant.upsert({
    where: { slug: 'demo-client' },
    update: { organization_type: 'CLIENT' },
    create: {
      name: 'Demo Property Client',
      slug: 'demo-client',
      contact_email: 'client@demo.test',
      subscription_plan: 'professional',
      status: 'ACTIVE',
      organization_type: 'CLIENT',
      max_users: 50,
      max_spaces: 20,
    },
  });

  // ── Users (one per role for UI / integration tests) ─────────────────────────
  const users = [
    { email: 'admin@leasemanager.com', role: 'SUPER_ADMIN', tenant_id: landlord.id, first_name: 'Super', last_name: 'Admin' },
    { email: 'client@demo.test', role: 'CLIENT_ADMIN', tenant_id: demoClient.id, first_name: 'Client', last_name: 'Owner', must_change_password: false },
    { email: 'manager@leasemanager.com', role: 'MANAGER', tenant_id: demoClient.id, first_name: 'Ops', last_name: 'Manager' },
    { email: 'finance@leasemanager.com', role: 'FINANCE', tenant_id: demoClient.id, first_name: 'Finance', last_name: 'User' },
    { email: 'maint@leasemanager.com', role: 'MAINTENANCE', tenant_id: demoClient.id, first_name: 'Maint', last_name: 'Tech' },
    { email: 'tenant.admin@acme-corp.test', role: 'TENANT_ADMIN', tenant_id: customerTenant.id, tenant_company_id: customerTenant.id, first_name: 'Alice', last_name: 'Tenant' },
    { email: 'employee@acme-corp.test', role: 'TENANT_EMPLOYEE', tenant_id: customerTenant.id, tenant_company_id: customerTenant.id, first_name: 'Bob', last_name: 'Employee' },
  ] as const;

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        role: u.role,
        status: 'ACTIVE',
        tenant_id: u.tenant_id,
        ...(('tenant_company_id' in u) && u.tenant_company_id ? { tenant_company_id: u.tenant_company_id } : {}),
        ...(('must_change_password' in u) ? { must_change_password: u.must_change_password } : {}),
      },
      create: {
        tenant_id: u.tenant_id,
        email: u.email,
        password: hash,
        first_name: u.first_name,
        last_name: u.last_name,
        role: u.role,
        status: 'ACTIVE',
        ...(('tenant_company_id' in u) && u.tenant_company_id ? { tenant_company_id: u.tenant_company_id } : {}),
        ...(('must_change_password' in u) ? { must_change_password: u.must_change_password } : { must_change_password: false }),
      },
    });
  }

  // ── Building → Floor → Spaces ───────────────────────────────────────────────
  const building = await prisma.building.upsert({
    where: { slug: 'demo-building-a' },
    update: { tenant_id: demoClient.id },
    create: {
      tenant_id: demoClient.id,
      name: 'Building A',
      slug: 'demo-building-a',
      description: 'Main tower — seed data for PFE tests',
    },
  });

  const floor = await prisma.floor.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      building_id: building.id,
      name: 'Ground Floor',
      floor_number: 0,
      area_sqm: 500,
      status: 'ACTIVE',
    },
  });

  const spaceDefs = [
    { slug: 'hot-desk-01', name: 'Hot Desk 01', type: 'HOT_DESK', is_listed: true, monthly_rate: 350 },
    { slug: 'private-office-01', name: 'Private Office 01', type: 'DEDICATED_OFFICE', is_listed: true, monthly_rate: 1200 },
    { slug: 'meeting-room-01', name: 'Meeting Room Alpha', type: 'MEETING_ROOM', is_listed: false, hourly_rate: 45 },
  ] as const;

  const spaces: { slug: string; id: string; name: string }[] = [];
  for (const s of spaceDefs) {
    const space = await prisma.space.upsert({
      where: { slug: s.slug },
      update: { status: 'AVAILABLE', is_listed: s.is_listed },
      create: {
        floor_id: floor.id,
        name: s.name,
        slug: s.slug,
        type: s.type,
        status: 'AVAILABLE',
        capacity: s.type === 'MEETING_ROOM' ? 8 : 1,
        area_sqm: s.type === 'DEDICATED_OFFICE' ? 25 : 5,
        hourly_rate: 'hourly_rate' in s ? s.hourly_rate : null,
        monthly_rate: 'monthly_rate' in s ? s.monthly_rate : null,
        currency: 'EUR',
        is_listed: s.is_listed,
        description: `Test space — ${s.name}`,
      },
    });
    spaces.push({ slug: s.slug, id: space.id, name: s.name });
  }

  // ── Typeform: pre-created inquiry (use URL from API or below) ───────────────
  const typeformInquiry = await prisma.tenantApplication.upsert({
    where: { id: '00000000-0000-4000-8000-00000000a001' },
    update: { space_id: spaces[0].id },
    create: {
      id: '00000000-0000-4000-8000-00000000a001',
      landlord_tenant_id: landlord.id,
      space_id: spaces[0].id,
      status: 'AWAITING_SUBMISSION',
    },
  });

  const formId = process.env.TYPEFORM_FORM_ID?.trim() || 'UQgEsPLO';
  const typeformBase =
    process.env.TYPEFORM_BASE_URL?.trim() || 'https://form.typeform.com/to';
  const typeformUrl = `${typeformBase.replace(/\/$/, '')}/${formId}#inquiry_id=${encodeURIComponent(typeformInquiry.id)}&space_id=${encodeURIComponent(spaces[0].id)}`;

  // ── Sample contract + booking (optional smoke data) ─────────────────────────
  const tenantAdmin = await prisma.user.findUnique({
    where: { email: 'tenant.admin@acme-corp.test' },
  });

  const financeUser = await prisma.user.findUnique({
    where: { email: 'finance@leasemanager.com' },
  });

  if (tenantAdmin) {
    const contract = await prisma.leaseContract.upsert({
      where: { contract_number: 'LC-DEMO-001' },
      update: {},
      create: {
        tenant_id: customerTenant.id,
        user_id: tenantAdmin.id,
        contract_number: 'LC-DEMO-001',
        start_date: new Date(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        monthly_rent: 1200,
        status: 'ACTIVE',
      },
    });

    // Demo invoices & payments for Finance dashboard / billing screens
    const invPaid = await prisma.invoice.upsert({
      where: { invoice_number: 'INV-DEMO-PAID-001' },
      update: {},
      create: {
        tenant_id: customerTenant.id,
        user_id: tenantAdmin.id,
        contract_id: contract.id,
        invoice_number: 'INV-DEMO-PAID-001',
        type: 'MONTHLY_RENT',
        amount: 1200,
        subtotal: 1200,
        total_amount: 1200,
        currency: 'USD',
        status: 'PAID',
        issue_date: new Date(Date.now() - 30 * 86400000),
        due_date: new Date(Date.now() - 15 * 86400000),
        paid_at: new Date(Date.now() - 10 * 86400000),
      },
    });

    const invOverdue = await prisma.invoice.upsert({
      where: { invoice_number: 'INV-DEMO-OVERDUE-001' },
      update: {},
      create: {
        tenant_id: customerTenant.id,
        user_id: tenantAdmin.id,
        contract_id: contract.id,
        invoice_number: 'INV-DEMO-OVERDUE-001',
        type: 'MONTHLY_RENT',
        amount: 1200,
        subtotal: 1200,
        total_amount: 1200,
        currency: 'USD',
        status: 'OVERDUE',
        issue_date: new Date(Date.now() - 45 * 86400000),
        due_date: new Date(Date.now() - 14 * 86400000),
      },
    });

    await prisma.invoice.upsert({
      where: { invoice_number: 'INV-DEMO-ISSUED-001' },
      update: {},
      create: {
        tenant_id: customerTenant.id,
        user_id: tenantAdmin.id,
        contract_id: contract.id,
        invoice_number: 'INV-DEMO-ISSUED-001',
        type: 'ADDON_SERVICE',
        amount: 450,
        subtotal: 450,
        total_amount: 450,
        currency: 'USD',
        status: 'ISSUED',
        issue_date: new Date(),
        due_date: new Date(Date.now() + 14 * 86400000),
      },
    });

    await prisma.payment.upsert({
      where: { transaction_id: 'PAY-DEMO-001' },
      update: {},
      create: {
        tenant_id: customerTenant.id,
        user_id: tenantAdmin.id,
        invoice_id: invPaid.id,
        recorded_by_id: financeUser?.id,
        payment_number: 'PAY-DEMO-001',
        transaction_id: 'PAY-DEMO-001',
        amount: 1200,
        method: 'BANK_TRANSFER',
        status: 'COMPLETED',
        payment_date: new Date(Date.now() - 10 * 86400000),
        paid_at: new Date(Date.now() - 10 * 86400000),
      },
    });

    await prisma.booking.upsert({
      where: { booking_number: 'BK-DEMO-001' },
      update: {},
      create: {
        tenant_id: customerTenant.id,
        user_id: tenantAdmin.id,
        space_id: spaces[2].id,
        booking_number: 'BK-DEMO-001',
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 26 * 60 * 60 * 1000),
        status: 'CONFIRMED',
        total_amount: 90,
        total_price: 90,
      },
    });
  }

  // ── Demo add-on services (landlord catalog for portal booking) ───────────────
  const addonDefs = [
    { name: 'Coffee & snacks package', category: 'CATERING', price: 45, billing_cycle: 'HOURLY' },
    { name: 'Projector rental', category: 'OFFICE_EQUIPMENT', price: 35, billing_cycle: 'HOURLY' },
    { name: 'Visitor parking pass', category: 'PARKING', price: 15, billing_cycle: 'DAILY' },
  ];
  for (const a of addonDefs) {
    const existing = await prisma.addOnService.findFirst({
      where: { tenant_id: landlord.id, name: a.name },
    });
    if (!existing) {
      await prisma.addOnService.create({
        data: {
          tenant_id: landlord.id,
          name: a.name,
          category: a.category,
          price: a.price,
          billing_cycle: a.billing_cycle,
          is_active: true,
          description: `Demo ${a.name}`,
        },
      });
    }
  }

  const line = '─'.repeat(72);
  console.log(`\n${line}`);
  console.log('  LeaseManager — demo seed (all passwords: Password123!)');
  console.log(line);
  console.log('\n  USERS (login at http://localhost:5173/login)\n');
  for (const u of users) {
    console.log(`    ${u.role.padEnd(14)} ${u.email}`);
  }
  console.log('\n  ENTITIES (for Swagger / Typeform / API tests)\n');
  console.log(`    landlord_tenant_id  ${landlord.id}`);
  console.log(`    customer_tenant_id  ${customerTenant.id}`);
  console.log(`    building_id         ${building.id}`);
  console.log(`    floor_id            ${floor.id}`);
  for (const s of spaces) {
    console.log(`    space_id            ${s.id}  (${s.name})`);
  }
  console.log(`    typeform_inquiry_id ${typeformInquiry.id}`);
  console.log('\n  TYPEFORM — quick test\n');
  console.log('    1. Open this URL in the browser and submit the form:');
  console.log(`       ${typeformUrl}`);
  console.log('    2. Or Swagger POST /forms/typeform/inquiry with body:');
  console.log(`       { "space_id": "${spaces[0].id}" }`);
  console.log('    3. Admin → Applications → pending application should appear.');
  console.log(`\n${line}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
