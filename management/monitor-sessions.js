const { PrismaClient } = require('@prisma/client');

async function monitorSessions() {
    const prisma = new PrismaClient();
    
    let lastCount = 0;
    
    async function checkSessions() {
        try {
            const sessions = await prisma.session.findMany({
                include: {
                    project: {
                        select: {
                            name: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            
            if (sessions.length !== lastCount) {
                console.log(`\n[${new Date().toISOString()}] Sessions changed! Total: ${sessions.length}`);
                
                // Show only the latest 3 sessions
                sessions.slice(0, 3).forEach((session, index) => {
                    console.log(`  ${index + 1}. ${session.sessionId.slice(-10)} | ${session.project?.name || 'Unknown'} | ${session.status} | ${session.createdAt.toISOString()}`);
                });
                
                lastCount = sessions.length;
            } else {
                process.stdout.write('.');
            }
        } catch (error) {
            console.error('Error:', error.message);
        }
    }
    
    console.log('Monitoring sessions... (Ctrl+C to stop)');
    console.log('Format: sessionId | project | status | created');
    
    // Initial check
    await checkSessions();
    
    // Check every 2 seconds
    const interval = setInterval(checkSessions, 2000);
    
    // Cleanup on exit
    process.on('SIGINT', async () => {
        clearInterval(interval);
        await prisma.$disconnect();
        console.log('\nMonitoring stopped.');
        process.exit(0);
    });
}

monitorSessions();
