import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const proposal = await db.proposal.findUnique({
      where: { id },
      include: {
        client: true,
        assignedMember: {
          select: { id: true, name: true, email: true, role: true },
        },
        thematicAreas: {
          include: {
            thematicArea: true,
          },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(proposal);
  } catch (error) {
    console.error("Error fetching proposal:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposal" },
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
    const {
      name,
      rfpNumber,
      clientId,
      assignedMemberId,
      value,
      status,
      remarks,
      deadline,
      submissionDate,
    } = body;

    const existingProposal = await db.proposal.findUnique({ where: { id } });
    if (!existingProposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    if (clientId) {
      const clientExists = await db.client.findUnique({
        where: { id: clientId },
      });
      if (!clientExists) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 400 }
        );
      }
    }

    if (assignedMemberId) {
      const memberExists = await db.teamMember.findUnique({
        where: { id: assignedMemberId },
      });
      if (!memberExists) {
        return NextResponse.json(
          { error: "Assigned team member not found" },
          { status: 400 }
        );
      }
    }

    const { thematicAreaIds } = body;

    // Handle thematic area updates in a transaction
    if (thematicAreaIds !== undefined) {
      await db.$transaction([
        db.proposalThematicArea.deleteMany({ where: { proposalId: id } }),
        ...(Array.isArray(thematicAreaIds) && thematicAreaIds.length > 0
          ? thematicAreaIds.map((areaId: string) =>
              db.proposalThematicArea.create({
                data: { proposalId: id, thematicAreaId: areaId },
              })
            )
          : []),
      ]);
    }

    const proposal = await db.proposal.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(rfpNumber !== undefined ? { rfpNumber } : {}),
        ...(clientId !== undefined ? { clientId } : {}),
        ...(assignedMemberId !== undefined ? { assignedMemberId } : {}),
        ...(value !== undefined ? { value } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
        ...(deadline !== undefined
          ? { deadline: deadline ? new Date(deadline) : null }
          : {}),
        ...(submissionDate !== undefined
          ? { submissionDate: submissionDate ? new Date(submissionDate) : null }
          : {}),
      },
      include: {
        client: {
          select: { id: true, name: true, status: true },
        },
        assignedMember: {
          select: { id: true, name: true, email: true, role: true },
        },
        thematicAreas: {
          include: {
            thematicArea: true,
          },
        },
      },
    });

    return NextResponse.json(proposal);
  } catch (error) {
    console.error("Error updating proposal:", error);
    return NextResponse.json(
      { error: "Failed to update proposal" },
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

    const existingProposal = await db.proposal.findUnique({ where: { id } });
    if (!existingProposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    await db.proposal.delete({ where: { id } });

    return NextResponse.json({ message: "Proposal deleted successfully" });
  } catch (error) {
    console.error("Error deleting proposal:", error);
    return NextResponse.json(
      { error: "Failed to delete proposal" },
      { status: 500 }
    );
  }
}
