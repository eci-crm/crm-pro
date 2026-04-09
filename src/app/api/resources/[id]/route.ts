import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    if (!resource.fileData) {
      return NextResponse.json(
        { error: "File data not found" },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(resource.fileData, "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": resource.fileType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${resource.name}"`,
        "Content-Length": String(buffer.length),
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
