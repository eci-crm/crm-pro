import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items array is required" },
        { status: 400 }
      );
    }

    await db.$transaction(
      items.map(
        (item: { id: string; sortOrder: number }) =>
          db.thematicArea.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          })
      )
    );

    return NextResponse.json({ message: "Reorder successful" });
  } catch (error) {
    console.error("Error reordering thematic areas:", error);
    return NextResponse.json(
      { error: "Failed to reorder thematic areas" },
      { status: 500 }
    );
  }
}
