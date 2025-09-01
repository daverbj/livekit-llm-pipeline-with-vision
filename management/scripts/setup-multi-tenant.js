const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSuperAdminAndTenants() {
  try {
    console.log('Setting up multi-tenant system...');

    // Create super admin
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (!existingSuperAdmin) {
      const hashedPassword = bcrypt.hashSync('superadmin123', 10);
      
      const superAdmin = await prisma.user.create({
        data: {
          username: 'superadmin',
          email: 'superadmin@system.com',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          isBlocked: false,
          tenantId: null // Super admin doesn't belong to any tenant
        }
      });

      console.log('Super Admin created:');
      console.log('Email: superadmin@system.com');
      console.log('Password: superadmin123');
    } else {
      console.log('Super Admin already exists');
    }

    // Create test tenants
    const testTenants = [
      { name: 'Acme Corp', domain: 'acme.example.com' },
      { name: 'TechStart Inc', domain: 'techstart.example.com' },
      { name: 'Global Solutions', domain: 'global.example.com' }
    ];

    for (const tenantData of testTenants) {
      const existingTenant = await prisma.tenant.findFirst({
        where: { name: tenantData.name }
      });

      if (!existingTenant) {
        const tenant = await prisma.tenant.create({
          data: tenantData
        });

        console.log(`Created tenant: ${tenant.name} (${tenant.domain})`);

        // Create an admin for this tenant
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        
        const adminUser = await prisma.user.create({
          data: {
            username: `admin_${tenant.name.toLowerCase().replace(/\s+/g, '_')}`,
            email: `admin@${tenantData.domain}`,
            password: hashedPassword,
            role: 'ADMIN',
            isBlocked: false,
            tenantId: tenant.id
          }
        });

        console.log(`Created admin for ${tenant.name}: ${adminUser.email} / admin123`);

        // Create some test users for this tenant
        const testUsers = [
          { username: 'user1', email: `user1@${tenantData.domain}` },
          { username: 'user2', email: `user2@${tenantData.domain}` }
        ];

        for (const userData of testUsers) {
          const userPassword = bcrypt.hashSync('user123', 10);
          
          const user = await prisma.user.create({
            data: {
              username: userData.username,
              email: userData.email,
              password: userPassword,
              role: 'USER',
              isBlocked: false,
              tenantId: tenant.id
            }
          });

          console.log(`Created user for ${tenant.name}: ${user.email} / user123`);
        }
      } else {
        console.log(`Tenant ${tenantData.name} already exists`);
      }
    }

    console.log('\nMulti-tenant setup completed!');
    console.log('\nLogin Credentials:');
    console.log('Super Admin: superadmin@system.com / superadmin123');
    console.log('Tenant Admins: admin@{tenant-domain} / admin123');
    console.log('Tenant Users: user1@{tenant-domain} / user123');

  } catch (error) {
    console.error('Error setting up multi-tenant system:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdminAndTenants();
