const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('👥 Checking all users and their credentials...\n');

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        role: true,
        tenantId: true,
        isBlocked: true,
        createdAt: true
      }
    });

    for (const user of users) {
      console.log(`👤 User: ${user.email} (${user.username})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Tenant: ${user.tenantId}`);
      console.log(`   Blocked: ${user.isBlocked}`);
      console.log(`   Password hash: ${user.password.substring(0, 20)}...`);
      
      // Test some common passwords
      const testPasswords = ['admin123', 'password', 'admin', 'quantimedx'];
      for (const testPassword of testPasswords) {
        const isMatch = await bcrypt.compare(testPassword, user.password);
        if (isMatch) {
          console.log(`   ✅ Password: ${testPassword}`);
          break;
        }
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
