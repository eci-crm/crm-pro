import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    // Check for self-reference or circular reference
    const existing = await db.resourceFolder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    if (name.trim()) {
      const updated = await db.resourceFolder.update({
        where: { id },
        data: { name: name.trim() },
        include: {
          _count: { select: { children: true, resources: true } },
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json(existing);
  } catch (error) {
    console.error("Error updating folder:", error);
    return NextResponse.json(
      { error: "Failed to update folder" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const folder = await db.resourceFolder.findUnique({
      where: { id },
      include: {
        _count: { select: { children: true, resources: true } },
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    await db.resourceFolder.delete({ where: { id } });

    return NextResponse.json({
      message: "Folder deleted successfully",
      deletedChildren: folder._count.children,
      movedResources: folder._count.resources,
    });
  } catch (error) {
    console.error("Error deleting folder:", error);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}
