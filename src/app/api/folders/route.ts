import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET all root folders (and optionally children by parentId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    if (parentId === "null" || !parentId) {
      // Get root-level folders
      const folders = await db.resourceFolder.findMany({
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { children: true, resources: true } },
        },
      });
      return NextResponse.json(folders);
    } else {
      // Get child folders of a specific parent
      const folders = await db.resourceFolder.findMany({
        where: { parentId },
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { children: true, resources: true } },
        },
      });
      return NextResponse.json(folders);
    }
  } catch (error) {
    console.error("Error fetching folders:", error);
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, parentId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    const folder = await db.resourceFolder.create({
      data: {
        name: name.trim(),
        parentId: parentId || null,
      },
      include: {
        _count: { select: { children: true, resources: true } },
      },
    });

    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
