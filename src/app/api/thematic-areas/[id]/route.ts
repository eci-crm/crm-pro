import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, color, sortOrder } = body;

    const existing = await db.thematicArea.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Thematic area not found" },
        { status: 404 }
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return NextResponse.json(
        { error: "Area name cannot be empty" },
        { status: 400 }
      );
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName !== existing.name) {
        const duplicate = await db.thematicArea.findUnique({
          where: { name: trimmedName },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "A thematic area with this name already exists" },
            { status: 409 }
          );
        }
      }
    }

    const area = await db.thematicArea.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });

    return NextResponse.json(area);
  } catch (error) {
    console.error("Error updating thematic area:", error);
    return NextResponse.json(
      { error: "Failed to update thematic area" },
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

    const existing = await db.thematicArea.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Thematic area not found" },
        { status: 404 }
      );
    }

    await db.thematicArea.delete({ where: { id } });

    return NextResponse.json({ message: "Thematic area deleted successfully" });
  } catch (error) {
    console.error("Error deleting thematic area:", error);
    return NextResponse.json(
      { error: "Failed to delete thematic area" },
      { status: 500 }
    );
  }
}
