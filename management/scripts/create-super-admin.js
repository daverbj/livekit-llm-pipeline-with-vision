const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    console.log('Creating Super Admin...');

    // Check if super admin already exists
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (existingSuperAdmin) {
      console.log('Super Admin already exists:');
      console.log(`Email: ${existingSuperAdmin.email}`);
      console.log(`Username: ${existingSuperAdmin.username}`);
      console.log('No action needed.');
      return;
    }

    // Create super admin
    const hashedPassword = bcrypt.hashSync('harry123', 10);
    
    const superAdmin = await prisma.user.create({
      data: {
        username: 'superadmin',
        email: 'superadmin@quantimedx.com',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isBlocked: false,
        tenantId: null // Super admin doesn't belong to any tenant
      }
    });

  } catch (error) {
    console.error('❌ Error creating Super Admin:', error);
    
    if (error.code === 'P2002') {
      console.log('Note: This error typically means a user with this email or username already exists.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createSuperAdmin();
