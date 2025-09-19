import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'demo.cloudcall.com' },
    update: {},
    create: {
      name: 'Demo Company',
      domain: 'demo.cloudcall.com',
      planType: 'professional',
      maxExtensions: 50,
      maxConcurrentCalls: 25,
      features: JSON.stringify([
        { name: 'call_recording', enabled: true },
        { name: 'ivr', enabled: true },
        { name: 'queue_management', enabled: true },
        { name: 'reports', enabled: true }
      ])
    }
  });

  console.log('✅ Created tenant:', tenant.name);

  // Create superadmin user (platform admin)
  const superadminPassword = await bcrypt.hash('superadmin123', 12);

  const superadminUser = await prisma.user.upsert({
    where: { email: 'superadmin@cloudcall.com' },
    update: {},
    create: {
      email: 'superadmin@cloudcall.com',
      password: superadminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'superadmin',
      tenantId: tenant.id
    }
  });

  console.log('✅ Created superadmin user:', superadminUser.email);

  // Create company admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.cloudcall.com' },
    update: {},
    create: {
      email: 'admin@demo.cloudcall.com',
      password: hashedPassword,
      firstName: 'Company',
      lastName: 'Admin',
      role: 'company_admin',
      tenantId: tenant.id
    }
  });

  console.log('✅ Created company admin user:', adminUser.email);

  // Create agent users
  const agents = [
    { firstName: 'John', lastName: 'Doe', email: 'john@demo.cloudcall.com' },
    { firstName: 'Jane', lastName: 'Smith', email: 'jane@demo.cloudcall.com' },
    { firstName: 'Mike', lastName: 'Johnson', email: 'mike@demo.cloudcall.com' }
  ];

  for (const agent of agents) {
    const agentPassword = await bcrypt.hash('agent123', 12);

    await prisma.user.upsert({
      where: { email: agent.email },
      update: {},
      create: {
        email: agent.email,
        password: agentPassword,
        firstName: agent.firstName,
        lastName: agent.lastName,
        role: 'agent',
        tenantId: tenant.id
      }
    });

    console.log('✅ Created agent user:', agent.email);
  }

  // Create extensions
  const extensions = [
    { number: '1001', displayName: 'Reception', type: 'user' },
    { number: '1002', displayName: 'Sales Desk', type: 'user' },
    { number: '2000', displayName: 'Sales Queue', type: 'queue' },
    { number: '3000', displayName: 'Conference Room', type: 'conference' },
    { number: '4000', displayName: 'Main IVR', type: 'ivr' }
  ];

  for (const ext of extensions) {
    await prisma.extension.upsert({
      where: {
        tenantId_number: {
          tenantId: tenant.id,
          number: ext.number
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        number: ext.number,
        displayName: ext.displayName,
        type: ext.type,
        config: JSON.stringify({
          voicemail: true,
          callWaiting: true,
          doNotDisturb: false,
          recordCalls: true
        })
      }
    });

    console.log('✅ Created extension:', ext.number, ext.displayName);
  }

  // Create a queue
  const queue = await prisma.queue.upsert({
    where: {
      tenantId_extension: {
        tenantId: tenant.id,
        extension: '2000'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Sales Queue',
      extension: '2000',
      strategy: 'round_robin',
      maxWaitTime: 300
    }
  });

  console.log('✅ Created queue:', queue.name);

  console.log('🎉 Database seed completed successfully!');
  console.log('');
  console.log('Demo credentials:');
  console.log('Admin: admin@demo.cloudcall.com / admin123');
  console.log('Agent: john@demo.cloudcall.com / agent123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });