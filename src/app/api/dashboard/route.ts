import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Total clients and active clients in one query
    const [totalClients, activeClients, totalProposals] = await Promise.all([
      db.client.count(),
      db.client.count({ where: { status: "Active" } }),
      db.proposal.count(),
    ]);

    // Proposals by status - sequential to avoid connection pool exhaustion
    const statuses = ["Submitted", "In Process", "In Evaluation", "Pending", "Won"];
    const proposalsByStatus: Array<{ status: string; count: number; totalValue: number }> = [];
    for (const status of statuses) {
      const count = await db.proposal.count({ where: { status } });
      const statusValue = await db.proposal.aggregate({
        where: { status },
        _sum: { value: true },
      });
      proposalsByStatus.push({
        status,
        count,
        totalValue: statusValue._sum.value || 0,
      });
    }

    // Upcoming deadlines and recent proposals
    const [upcomingDeadlines, recentProposals] = await Promise.all([
      db.proposal.findMany({
        where: {
          deadline: { gte: now, lte: sevenDaysLater },
          status: { not: "Won" },
        },
        orderBy: { deadline: "asc" },
        take: 10,
        include: {
          client: { select: { id: true, name: true } },
          assignedMember: { select: { id: true, name: true } },
        },
      }),
      db.proposal.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          client: { select: { id: true, name: true } },
          assignedMember: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Total and won values
    const [totalValue, wonValue] = await Promise.all([
      db.proposal.aggregate({ _sum: { value: true } }),
      db.proposal.aggregate({ where: { status: "Won" }, _sum: { value: true } }),
    ]);

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
      { error: "Failed to fetch dashboard stats", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
