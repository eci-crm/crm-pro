import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuditFromRequest } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const member = await db.teamMember.findUnique({
      where: { id },
      include: {
        proposals: {
          orderBy: { createdAt: "desc" },
          include: {
            client: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error fetching team member:", error);
    return NextResponse.json(
      { error: "Failed to fetch team member" },
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
    const { name, email, role, password } = body;

    const existingMember = await db.teamMember.findUnique({ where: { id } });
    if (!existingMember) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    // Check email uniqueness if email is being changed
    if (email && email !== existingMember.email) {
      const emailExists = await db.teamMember.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (emailExists) {
        return NextResponse.json(
          { error: "A team member with this email already exists" },
          { status: 409 }
        );
      }
    }

    const member = await db.teamMember.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(password !== undefined && password !== "" ? { password } : {}),
      },
    });

    // Audit log (fire-and-forget)
    logAuditFromRequest(request, {
      action: 'UPDATE',
      entityType: 'TeamMember',
      entityId: member.id,
      entityName: member.name,
      details: `Updated team member: ${member.name} (Role: ${existingMember.role} → ${member.role || existingMember.role})`,
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error updating team member:", error);
    return NextResponse.json(
      { error: "Failed to update team member" },
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

    const existingMember = await db.teamMember.findUnique({ where: { id } });
    if (!existingMember) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    // Unassign this member from all proposals before deleting
    await db.proposal.updateMany({
      where: { assignedMemberId: id },
      data: { assignedMemberId: "" },
    });

    await db.teamMember.delete({ where: { id } });

    // Audit log (fire-and-forget)
    logAuditFromRequest(request, {
      action: 'DELETE',
      entityType: 'TeamMember',
      entityId: id,
      entityName: existingMember.name,
      details: `Deleted team member: ${existingMember.name} (${existingMember.email})`,
    });

    return NextResponse.json({
      message: "Team member deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting team member:", error);
    return NextResponse.json(
      { error: "Failed to delete team member" },
      { status: 500 }
    );
  }
}
