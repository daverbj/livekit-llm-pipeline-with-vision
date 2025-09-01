import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { createProjectCollection, normalizeCollectionName } from '@/lib/qdrant';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'User must be associated with a tenant' }, { status: 400 });
    }

    // Get all projects within the user's tenant
    const projects = await prisma.project.findMany({
      where: {
        tenantId: user.tenantId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only tenant admins can create projects
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only tenant admins can create projects' }, { status: 403 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'Admin must be associated with a tenant' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if project name already exists within the tenant
    const existingProject = await prisma.project.findFirst({
      where: {
        name: trimmedName,
        tenantId: user.tenantId
      }
    });

    if (existingProject) {
      return NextResponse.json({ error: 'A project with this name already exists' }, { status: 409 });
    }

    // Create project and Qdrant collection in a transaction-like approach
    let project;
    try {
      // Normalize the project name for collection name
      const collectionName = normalizeCollectionName(trimmedName);

      // First create the Qdrant collection
      await createProjectCollection(trimmedName);

      // Then create the project in the database with the normalized collection name
      project = await prisma.project.create({
        data: {
          name: trimmedName,
          collectionName: collectionName,
          description: description?.trim() || null,
          userId: user.id,
          tenantId: user.tenantId
        }
      });

      return NextResponse.json({ project }, { status: 201 });
    } catch (qdrantError: any) {
      console.error('Error creating Qdrant collection:', qdrantError);
      
      // If project was created but Qdrant failed, clean up the project
      if (project) {
        try {
          await prisma.project.delete({ where: { id: project.id } });
        } catch (cleanupError) {
          console.error('Failed to cleanup project after Qdrant error:', cleanupError);
        }
      }

      // Return appropriate error based on the Qdrant error
      if (qdrantError.message?.includes('already exists')) {
        return NextResponse.json({ error: 'A collection with this name already exists in the vector database' }, { status: 409 });
      }
      
      return NextResponse.json({ error: 'Failed to create vector database collection' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
