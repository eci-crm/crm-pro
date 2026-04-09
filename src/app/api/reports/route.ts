import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "summary";
    const clientId = searchParams.get("clientId") || "";
    const status = searchParams.get("status") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    // Build date filter for proposals
    const buildProposalDateFilter = (): Prisma.ProposalWhereInput => {
      const filter: Prisma.ProposalWhereInput = {};

      if (clientId) {
        filter.clientId = clientId;
      }

      if (status) {
        filter.status = status;
      }

      if (startDate || endDate) {
        const deadlineFilter: Prisma.DateTimeNullableFilter<"Proposal"> = {};
        if (startDate) {
          deadlineFilter.gte = new Date(startDate);
        }
        if (endDate) {
          deadlineFilter.lte = new Date(endDate);
        }
        filter.deadline = deadlineFilter;
      }

      return filter;
    };

    if (type === "clients") {
      // Clients report
      const where: Prisma.ClientWhereInput = {};

      if (clientId) {
        where.id = clientId;
      }

      if (status) {
        where.status = status;
      }

      const clients = await db.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { proposals: true } },
          proposals: {
            select: {
              id: true,
              name: true,
              status: true,
              value: true,
            },
          },
        },
      });

      const totalClients = clients.length;
      const activeClients = clients.filter(
        (c) => c.status === "Active"
      ).length;
      const totalProposalValue = clients.reduce(
        (sum, client) =>
          sum + client.proposals.reduce((ps, p) => ps + p.value, 0),
        0
      );

      return NextResponse.json({
        type: "clients",
        totalRecords: totalClients,
        summary: {
          totalClients,
          activeClients,
          inactiveClients: totalClients - activeClients,
          totalProposalValue,
        },
        data: clients,
      });
    }

    if (type === "proposals") {
      // Proposals report
      const proposalWhere = buildProposalDateFilter();

      const proposals = await db.proposal.findMany({
        where: Object.keys(proposalWhere).length > 0 ? proposalWhere : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: { id: true, name: true },
          },
          assignedMember: {
            select: { id: true, name: true },
          },
        },
      });

      const totalProposals = proposals.length;
      const totalValue = proposals.reduce((sum, p) => sum + p.value, 0);

      // Group by status
      const statusGroups: Record<string, { count: number; totalValue: number }> = {};
      for (const proposal of proposals) {
        if (!statusGroups[proposal.status]) {
          statusGroups[proposal.status] = { count: 0, totalValue: 0 };
        }
        statusGroups[proposal.status].count += 1;
        statusGroups[proposal.status].totalValue += proposal.value;
      }

      // Group by client
      const clientGroups: Record<string, { count: number; totalValue: number; clientName: string }> = {};
      for (const proposal of proposals) {
        if (!clientGroups[proposal.clientId]) {
          clientGroups[proposal.clientId] = {
            count: 0,
            totalValue: 0,
            clientName: proposal.client.name,
          };
        }
        clientGroups[proposal.clientId].count += 1;
        clientGroups[proposal.clientId].totalValue += proposal.value;
      }

      return NextResponse.json({
        type: "proposals",
        totalRecords: totalProposals,
        summary: {
          totalProposals,
          totalValue,
          byStatus: statusGroups,
          byClient: clientGroups,
        },
        data: proposals,
      });
    }

    // Summary report (default)
    const totalClients = await db.client.count();
    const activeClients = await db.client.count({
      where: { status: "Active" },
    });
    const totalProposals = await db.proposal.count();

    const proposalWhere = buildProposalDateFilter();
    const filteredProposals = await db.proposal.findMany({
      where: Object.keys(proposalWhere).length > 0 ? proposalWhere : undefined,
      include: {
        client: {
          select: { id: true, name: true },
        },
        assignedMember: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalFilteredValue = filteredProposals.reduce(
      (sum, p) => sum + p.value,
      0
    );

    const statusGroups: Record<string, { count: number; totalValue: number }> = {};
    for (const proposal of filteredProposals) {
      if (!statusGroups[proposal.status]) {
        statusGroups[proposal.status] = { count: 0, totalValue: 0 };
      }
      statusGroups[proposal.status].count += 1;
      statusGroups[proposal.status].totalValue += proposal.value;
    }

    return NextResponse.json({
      type: "summary",
      totalRecords: filteredProposals.length,
      summary: {
        clients: {
          total: totalClients,
          active: activeClients,
        },
        proposals: {
          total: totalProposals,
          filtered: filteredProposals.length,
          totalFilteredValue,
          byStatus: statusGroups,
        },
      },
      data: filteredProposals,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
