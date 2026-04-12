import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuditFromRequest } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const client = await db.client.findUnique({
      where: { id },
      include: {
        proposals: {
          orderBy: { createdAt: "desc" },
          include: {
            assignedMember: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, address, status } = body;

    const existingClient = await db.client.findUnique({ where: { id } });
    if (!existingClient) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const client = await db.client.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });

    // Audit log (fire-and-forget)
    logAuditFromRequest(request, {
      action: 'UPDATE',
      entityType: 'Client',
      entityId: client.id,
      entityName: client.name,
      details: `Updated client: ${client.name} (Status: ${existingClient.status} → ${client.status || existingClient.status})`,
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
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

    const existingClient = await db.client.findUnique({ where: { id } });
    if (!existingClient) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    await db.client.delete({ where: { id } });

    // Audit log (fire-and-forget)
    logAuditFromRequest(request, {
      action: 'DELETE',
      entityType: 'Client',
      entityId: id,
      entityName: existingClient.name,
      details: `Deleted client: ${existingClient.name}`,
    });

    return NextResponse.json({ message: "Client deleted successfully" });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
