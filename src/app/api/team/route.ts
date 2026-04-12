import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuditFromRequest } from "@/lib/audit";

export async function GET() {
  try {
    const members = await db.teamMember.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { proposals: true },
        },
      },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, role, password } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Team member name is required" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || email.trim() === "") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 4) {
      return NextResponse.json(
        { error: "Password is required (minimum 4 characters)" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingMember = await db.teamMember.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "A team member with this email already exists" },
        { status: 409 }
      );
    }

    const member = await db.teamMember.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role || "Member",
        password: password,
      },
    });

    // Audit log (fire-and-forget)
    logAuditFromRequest(request, {
      action: 'CREATE',
      entityType: 'TeamMember',
      entityId: member.id,
      entityName: member.name,
      details: `Added team member: ${member.name} (${member.email}) as ${member.role}`,
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Error creating team member:", error);
    return NextResponse.json(
      { error: "Failed to create team member" },
      { status: 500 }
    );
  }
}
