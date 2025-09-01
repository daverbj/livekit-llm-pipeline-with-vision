const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('Creating test users...');

    // First, get an existing tenant to assign users to
    const acmeTenant = await prisma.tenant.findUnique({
      where: { name: 'Acme Corp' }
    });

    if (!acmeTenant) {
      console.error('Acme Corp tenant not found. Please run the multi-tenant setup script first.');
      return;
    }

    console.log(`Found tenant: ${acmeTenant.name} (ID: ${acmeTenant.id})`);

    const testUsers = [
      {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'USER',
        tenantId: acmeTenant.id
      },
      {
        username: 'jane_smith',
        email: 'jane@example.com',
        password: 'password123',
        role: 'USER',
        tenantId: acmeTenant.id
      },
      {
        username: 'bob_wilson',
        email: 'bob@example.com',
        password: 'password123',
        role: 'USER',
        tenantId: acmeTenant.id
      },
      {
        username: 'alice_brown',
        email: 'alice@example.com',
        password: 'password123',
        role: 'USER',
        tenantId: acmeTenant.id
      }
    ];

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: userData.email },
            { username: userData.username }
          ]
        }
      });

      if (existingUser) {
        console.log(`User ${userData.username} already exists, skipping...`);
        continue;
      }

      // Hash the password
      const hashedPassword = bcrypt.hashSync(userData.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          role: userData.role,
          tenantId: userData.tenantId,
          isBlocked: false
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true
        }
      });

      console.log(`Created user: ${user.username} (${user.email})`);
    }

    console.log('Test users creation completed!');
    console.log('All test users have password: password123');

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
