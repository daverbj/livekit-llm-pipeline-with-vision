import { prisma } from './src/lib/prisma';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test the connection
    await prisma.$connect();
    console.log('✅ Database connected successfully!');
    
    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`📊 Current user count: ${userCount}`);
    
    console.log('🎉 Database setup is working correctly!');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
