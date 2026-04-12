import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuditFromRequest } from "@/lib/audit";

export async function GET() {
  try {
    const areas = await db.thematicArea.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(areas);
  } catch (error) {
    console.error("Error fetching thematic areas:", error);
    return NextResponse.json(
      { error: "Failed to fetch thematic areas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Area name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // Check uniqueness
    const existing = await db.thematicArea.findUnique({
      where: { name: trimmedName },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A thematic area with this name already exists" },
        { status: 409 }
      );
    }

    // Get max sortOrder
    const maxSort = await db.thematicArea.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const area = await db.thematicArea.create({
      data: {
        name: trimmedName,
        color: color || "#3b82f6",
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
      },
    });

    // Audit log (fire-and-forget)
    logAuditFromRequest(request, {
      action: 'CREATE',
      entityType: 'ThematicArea',
      entityId: area.id,
      entityName: area.name,
      details: `Created thematic area: ${area.name}`,
    });

    return NextResponse.json(area, { status: 201 });
  } catch (error) {
    console.error("Error creating thematic area:", error);
    return NextResponse.json(
      { error: "Failed to create thematic area" },
      { status: 500 }
    );
  }
}
