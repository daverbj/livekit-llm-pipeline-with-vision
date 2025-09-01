const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@example.com' },
          { username: 'admin' }
        ]
      }
    });

    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return;
    }

    // Hash the password
    const hashedPassword = bcrypt.hashSync('admin123', 10);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'ADMIN',
        isBlocked: false
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true
      }
    });

    console.log('Admin user created successfully:');
    console.log('Email:', adminUser.email);
    console.log('Username:', adminUser.username);
    console.log('Password: admin123');
    console.log('Role:', adminUser.role);
    console.log('Created at:', adminUser.createdAt);

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
