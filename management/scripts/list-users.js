const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listUsers() {
  try {
    console.log('Listing all users...\n');

    const users = await prisma.user.findMany({
      include: {
        tenant: true
      },
      orderBy: [
        { role: 'asc' },
        { username: 'asc' }
      ]
    });

    users.forEach(user => {
      console.log(`Username: ${user.username}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log(`Tenant: ${user.tenant?.name || 'No tenant'}`);
      console.log(`Blocked: ${user.isBlocked}`);
      console.log('---');
    });

    console.log(`\nTotal users: ${users.length}`);

  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
