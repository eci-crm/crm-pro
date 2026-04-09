import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    const where: { folderId?: string | null } = {};
    if (folderId === "root" || folderId === "null") {
      where.folderId = null;
    } else if (folderId) {
      where.folderId = folderId;
    }

    const resources = await db.resource.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        filePath: true,
        fileType: true,
        fileSize: true,
        folderId: true,
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(resources);
  } catch (error) {
    console.error("Error fetching resources:", error);
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString("base64");

    const resource = await db.resource.create({
      data: {
        name: file.name,
        filePath: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        fileData: base64Data,
        folderId: folderId && folderId !== "root" && folderId !== "null" ? folderId : null,
      },
      select: {
        id: true,
        name: true,
        filePath: true,
        fileType: true,
        fileSize: true,
        folderId: true,
        folder: {
          select: { id: true, name: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    console.error("Error uploading resource:", error);
    return NextResponse.json(
      { error: "Failed to upload resource" },
      { status: 500 }
    );
  }
}
