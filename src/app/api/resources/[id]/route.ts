import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const resource = await db.resource.findUnique({ where: { id } });

    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    const fullPath = path.join(process.cwd(), "public", resource.filePath);

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: "File not found on disk" },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(fullPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": resource.fileType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${resource.name}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (error) {
    console.error("Error downloading resource:", error);
    return NextResponse.json(
      { error: "Failed to download resource" },
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

    const resource = await db.resource.findUnique({ where: { id } });

    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // Delete the physical file
    const fullPath = path.join(process.cwd(), "public", resource.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Delete the database record
    await db.resource.delete({ where: { id } });

    return NextResponse.json({ message: "Resource deleted successfully" });
  } catch (error) {
    console.error("Error deleting resource:", error);
    return NextResponse.json(
      { error: "Failed to delete resource" },
      { status: 500 }
    );
  }
}
