import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { deleteProjectCollection } from '@/lib/qdrant';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'User must be associated with a tenant' }, { status: 400 });
    }

    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId  // Allow any user in the tenant to view projects
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only tenant admins can modify projects
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only tenant admins can modify projects' }, { status: 403 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'Admin must be associated with a tenant' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const { id } = await params;
    // Check if project exists and belongs to tenant
    const existingProject = await prisma.project.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const trimmedName = name.trim();

    // Check if the new name conflicts with another project in the tenant (excluding current project)
    if (trimmedName !== existingProject.name) {
      const nameExists = await prisma.project.findFirst({
        where: {
          name: trimmedName,
          tenantId: user.tenantId,
          id: { not: id }
        }
      });

      if (nameExists) {
        return NextResponse.json({ error: 'A project with this name already exists in your organization' }, { status: 409 });
      }
    }

    const project = await prisma.project.update({
      where: {
        id: id
      },
      data: {
        name: trimmedName,
        description: description?.trim() || null
        // Note: collectionName remains unchanged to avoid data migration complexity
      }
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only tenant admins can delete projects
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only tenant admins can delete projects' }, { status: 403 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'Admin must be associated with a tenant' }, { status: 400 });
    }

    const { id } = await params;
    // Check if project exists and belongs to tenant
    const existingProject = await prisma.project.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    try {
      // First delete the Qdrant collection using the stored collection name
      await deleteProjectCollection(existingProject.collectionName);
    } catch (qdrantError) {
      console.error('Error deleting Qdrant collection:', qdrantError);
      // Continue with project deletion even if Qdrant deletion fails
      // Log the error but don't block the operation
    }

    // Delete the project from database
    await prisma.project.delete({
      where: {
        id: id
      }
    });

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
