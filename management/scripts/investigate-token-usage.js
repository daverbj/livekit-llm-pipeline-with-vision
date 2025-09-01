const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function investigateTokenUsage() {
  try {
    console.log('🔍 Investigating token usage distribution...\n');

    // Get all users with their session data
    const users = await prisma.user.findMany({
      include: {
        projects: {
          include: {
            sessions: {
              select: {
                id: true,
                sessionId: true,
                userId: true,
                projectId: true,
                inputTokens: true,
                outputTokens: true,
                totalTokens: true,
                createdAt: true,
                status: true
              }
            }
          }
        }
      }
    });

    console.log(`📊 Found ${users.length} total users\n`);

    for (const user of users) {
      console.log(`👤 User: ${user.email} (${user.username}) - Role: ${user.role}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Projects: ${user.projects.length}`);
      
      let totalSessions = 0;
      let totalTokens = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      for (const project of user.projects) {
        console.log(`   📁 Project: ${project.name} (${project.sessions.length} sessions)`);
        totalSessions += project.sessions.length;
        
        for (const session of project.sessions) {
          totalTokens += session.totalTokens || 0;
          totalInputTokens += session.inputTokens || 0;
          totalOutputTokens += session.outputTokens || 0;
          
          console.log(`      💬 Session: ${session.sessionId}`);
          console.log(`         - User ID: ${session.userId} ${session.userId === user.id ? '✅' : '❌ MISMATCH!'}`);
          console.log(`         - Tokens: ${session.totalTokens} (in: ${session.inputTokens}, out: ${session.outputTokens})`);
          console.log(`         - Status: ${session.status}`);
          console.log(`         - Created: ${session.createdAt}`);
        }
      }
      
      console.log(`   🔢 Total Sessions: ${totalSessions}`);
      console.log(`   🎯 Total Tokens: ${totalTokens} (in: ${totalInputTokens}, out: ${totalOutputTokens})\n`);
    }

    // Also check for any orphaned sessions
    console.log('🔍 Checking for orphaned sessions...\n');
    
    const allSessions = await prisma.session.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            role: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        }
      }
    });

    console.log(`📊 Found ${allSessions.length} total sessions\n`);

    const sessionsByUser = {};
    for (const session of allSessions) {
      const userKey = `${session.user.email} (${session.user.role})`;
      if (!sessionsByUser[userKey]) {
        sessionsByUser[userKey] = {
          user: session.user,
          sessions: [],
          totalTokens: 0
        };
      }
      sessionsByUser[userKey].sessions.push(session);
      sessionsByUser[userKey].totalTokens += session.totalTokens || 0;
    }

    console.log('📈 Session distribution by user:');
    for (const [userKey, data] of Object.entries(sessionsByUser)) {
      console.log(`   ${userKey}: ${data.sessions.length} sessions, ${data.totalTokens} total tokens`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateTokenUsage();
