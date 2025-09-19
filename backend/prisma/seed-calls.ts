import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCalls() {
  console.log('🌱 Adding sample call data...');

  // Get the demo tenant and extensions
  const tenant = await prisma.tenant.findUnique({
    where: { domain: 'demo.cloudcall.com' }
  });

  if (!tenant) {
    console.error('Demo tenant not found. Please run the main seed first.');
    return;
  }

  const extensions = await prisma.extension.findMany({
    where: { tenantId: tenant.id },
    include: { user: true }
  });

  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id, role: { in: ['agent', 'admin'] } }
  });

  if (extensions.length === 0 || users.length === 0) {
    console.error('No extensions or users found. Please run the main seed first.');
    return;
  }

  // Create sample calls
  const sampleCalls = [
    {
      fromNumber: '+1-555-123-4567',
      toNumber: extensions[0]?.number || '1001',
      direction: 'inbound' as const,
      status: 'completed' as const,
      startTime: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
      endTime: new Date(Date.now() - 1000 * 60 * 10), // 10 minutes ago
      duration: 300, // 5 minutes
      extensionId: extensions[0]?.id,
      agentId: users[0]?.id
    },
    {
      fromNumber: '+1-555-987-6543',
      toNumber: extensions[1]?.number || '1002',
      direction: 'inbound' as const,
      status: 'completed' as const,
      startTime: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      endTime: new Date(Date.now() - 1000 * 60 * 25), // 25 minutes ago
      duration: 300, // 5 minutes
      extensionId: extensions[1]?.id,
      agentId: users[1]?.id || users[0]?.id
    },
    {
      fromNumber: extensions[0]?.number || '1001',
      toNumber: '+1-555-555-1234',
      direction: 'outbound' as const,
      status: 'completed' as const,
      startTime: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
      endTime: new Date(Date.now() - 1000 * 60 * 40), // 40 minutes ago
      duration: 300, // 5 minutes
      extensionId: extensions[0]?.id,
      agentId: users[0]?.id
    },
    {
      fromNumber: '+1-555-444-3333',
      toNumber: extensions[0]?.number || '1001',
      direction: 'inbound' as const,
      status: 'answered' as const,
      startTime: new Date(Date.now() - 1000 * 60 * 2), // 2 minutes ago (active call)
      extensionId: extensions[0]?.id,
      agentId: users[0]?.id
    },
    {
      fromNumber: '+1-555-222-1111',
      toNumber: extensions[1]?.number || '1002',
      direction: 'inbound' as const,
      status: 'ringing' as const,
      startTime: new Date(Date.now() - 1000 * 30), // 30 seconds ago (ringing)
      extensionId: extensions[1]?.id
    },
    {
      fromNumber: '+1-555-999-8888',
      toNumber: extensions[0]?.number || '1001',
      direction: 'inbound' as const,
      status: 'failed' as const,
      startTime: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      endTime: new Date(Date.now() - 1000 * 60 * 60 + 1000 * 10), // Failed after 10 seconds
      duration: 0,
      extensionId: extensions[0]?.id
    }
  ];

  for (const callData of sampleCalls) {
    await prisma.call.create({
      data: {
        ...callData,
        tenantId: tenant.id
      }
    });
  }

  console.log(`✅ Created ${sampleCalls.length} sample calls`);
  console.log('🎉 Sample call data added successfully!');
}

seedCalls()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });