import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Total clients
    const totalClients = await db.client.count();

    // Active clients
    const activeClients = await db.client.count({
      where: { status: "Active" },
    });

    // Total proposals
    const totalProposals = await db.proposal.count();

    // Proposals by status
    const statuses = [
      "Submitted",
      "In Process",
      "In Evaluation",
      "Pending",
      "Won",
    ];

    const proposalsByStatus = await Promise.all(
      statuses.map(async (status) => {
        const count = await db.proposal.count({
          where: { status },
        });

        const statusValue = await db.proposal.aggregate({
          where: { status },
          _sum: { value: true },
        });

        return {
          status,
          count,
          totalValue: statusValue._sum.value || 0,
        };
      })
    );

    // Upcoming deadlines (next 7 days, exclude past)
    const upcomingDeadlines = await db.proposal.findMany({
      where: {
        deadline: {
          gte: now,
          lte: sevenDaysLater,
        },
        status: { not: "Won" },
      },
      orderBy: { deadline: "asc" },
      include: {
        client: {
          select: { id: true, name: true },
        },
        assignedMember: {
          select: { id: true, name: true },
        },
      },
    });

    // Recent proposals (last 5)
    const recentProposals = await db.proposal.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        client: {
          select: { id: true, name: true },
        },
        assignedMember: {
          select: { id: true, name: true },
        },
      },
    });

    // Total proposal value
    const totalValue = await db.proposal.aggregate({
      _sum: { value: true },
    });

    // Won proposals total value
    const wonValue = await db.proposal.aggregate({
      where: { status: "Won" },
      _sum: { value: true },
    });

    return NextResponse.json({
      clients: {
        total: totalClients,
        active: activeClients,
      },
      proposals: {
        total: totalProposals,
        totalValue: totalValue._sum.value || 0,
        wonValue: wonValue._sum.value || 0,
        byStatus: proposalsByStatus,
      },
      upcomingDeadlines,
      recentProposals,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
