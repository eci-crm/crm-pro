import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const resources = await db.resource.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        filePath: true,
        fileType: true,
        fileSize: true,
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
