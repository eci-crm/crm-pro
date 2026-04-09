import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId") || "";
    const status = searchParams.get("status") || "";
    const assignedMemberId = searchParams.get("assignedMemberId") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};

    if (clientId) {
      where.clientId = clientId;
    }

    if (status) {
      where.status = status;
    }

    if (assignedMemberId) {
      where.assignedMemberId = assignedMemberId;
    }

    if (startDate || endDate) {
      const deadlineFilter: Prisma.DateTimeNullableFilter<"Proposal"> = {};
      if (startDate) {
        deadlineFilter.gte = new Date(startDate);
      }
      if (endDate) {
        deadlineFilter.lte = new Date(endDate);
      }
      where.deadline = deadlineFilter;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { rfpNumber: { contains: search } },
        { remarks: { contains: search } },
      ];
    }

    const proposals = await db.proposal.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
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

    return NextResponse.json(proposals);
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Proposal name is required" },
        { status: 400 }
      );
    }

    if (!clientId || typeof clientId !== "string") {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    const clientExists = await db.client.findUnique({
      where: { id: clientId },
    });
    if (!clientExists) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 400 }
      );
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

    const proposal = await db.proposal.create({
      data: {
        name: name.trim(),
        rfpNumber: rfpNumber || "",
        clientId,
        assignedMemberId: assignedMemberId || "",
        value: value || 0,
        status: status || "In Process",
        remarks: remarks || "",
        deadline: deadline ? new Date(deadline) : null,
        submissionDate: submissionDate ? new Date(submissionDate) : null,
        thematicAreas: Array.isArray(thematicAreaIds) && thematicAreaIds.length > 0
          ? {
              create: thematicAreaIds.map((areaId: string) => ({
                thematicAreaId: areaId,
              })),
            }
          : undefined,
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

    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    console.error("Error creating proposal:", error);
    return NextResponse.json(
      { error: "Failed to create proposal" },
      { status: 500 }
    );
  }
}
