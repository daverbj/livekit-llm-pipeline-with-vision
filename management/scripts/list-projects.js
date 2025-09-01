const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listProjects() {
  try {
    console.log('Listing all projects...\n');
    
    const projects = await prisma.project.findMany({
      include: {
        user: {
          select: {
            email: true,
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (projects.length === 0) {
      console.log('No projects found in the database.');
      return;
    }
    
    projects.forEach(project => {
      console.log(`ID: ${project.id}`);
      console.log(`Name: ${project.name}`);
      console.log(`Description: ${project.description || 'No description'}`);
      console.log(`Collection: ${project.collectionName || 'No collection'}`);
      console.log(`User: ${project.user.username} (${project.user.email})`);
      console.log(`Tenant: ${project.tenantId}`);
      console.log(`Created: ${project.createdAt.toISOString()}`);
      console.log('---');
    });
    
    console.log(`\nTotal projects: ${projects.length}`);
  } catch (error) {
    console.error('Error listing projects:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listProjects();
