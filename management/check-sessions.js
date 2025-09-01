const { PrismaClient } = require('@prisma/client');

async function checkSessions() {
    const prisma = new PrismaClient();
    
    try {
        console.log('Checking sessions in database...');
        
        // Get all sessions
        const sessions = await prisma.session.findMany({
            include: {
                project: {
                    select: {
                        name: true
                    }
                },
                user: {
                    select: {
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        console.log(`Found ${sessions.length} sessions:`);
        
        sessions.forEach((session, index) => {
            console.log(`${index + 1}. Session ID: ${session.sessionId}`);
            console.log(`   Project: ${session.project?.name || 'Unknown'}`);
            console.log(`   User: ${session.user?.email || 'Unknown'}`);
            console.log(`   Status: ${session.status}`);
            console.log(`   Created: ${session.createdAt}`);
            console.log(`   Updated: ${session.updatedAt}`);
            console.log(`   Duration: ${session.durationSeconds || 0} seconds`);
            console.log(`   Tokens: Input=${session.inputTokens || 0}, Output=${session.outputTokens || 0}`);
            console.log('---');
        });
        
        // Get session count by status
        const statusCounts = await prisma.session.groupBy({
            by: ['status'],
            _count: {
                status: true
            }
        });
        
        console.log('\nSession counts by status:');
        statusCounts.forEach(status => {
            console.log(`  ${status.status}: ${status._count.status}`);
        });
        
    } catch (error) {
        console.error('Error checking sessions:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSessions();
