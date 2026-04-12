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
    const thematicAreaId = searchParams.get("thematicAreaId") || "";
    const winningChances = searchParams.get("winningChances") || "";

    // Build proposal where filter with winning chances support
    const buildProposalWhere = (): Prisma.ProposalWhereInput => {
      const filter: Prisma.ProposalWhereInput = {};

      if (clientId) {
        filter.clientId = clientId;
      }

      if (status) {
        filter.status = status;
      }

      if (winningChances) {
        filter.winningChances = winningChances;
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
              winningChances: true,
              focalPerson: true,
              followupDate: true,
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
      const proposalWhere = buildProposalWhere();

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

      // Group by winning chances
      const winningGroups: Record<string, { count: number; totalValue: number }> = {};
      for (const proposal of proposals) {
        const wc = proposal.winningChances || "Not Set";
        if (!winningGroups[wc]) {
          winningGroups[wc] = { count: 0, totalValue: 0 };
        }
        winningGroups[wc].count += 1;
        winningGroups[wc].totalValue += proposal.value;
      }

      return NextResponse.json({
        type: "proposals",
        totalRecords: totalProposals,
        summary: {
          totalProposals,
          totalValue,
          byStatus: statusGroups,
          byClient: clientGroups,
          byWinningChances: winningGroups,
        },
        data: proposals,
      });
    }

    if (type === "thematic") {
      // Thematic Area report
      const proposalWhere: Prisma.ProposalWhereInput = {};

      if (clientId) {
        proposalWhere.clientId = clientId;
      }
      if (status) {
        proposalWhere.status = status;
      }
      if (winningChances) {
        proposalWhere.winningChances = winningChances;
      }
      if (startDate || endDate) {
        const deadlineFilter: Prisma.DateTimeNullableFilter<"Proposal"> = {};
        if (startDate) deadlineFilter.gte = new Date(startDate);
        if (endDate) deadlineFilter.lte = new Date(endDate);
        proposalWhere.deadline = deadlineFilter;
      }
      if (thematicAreaId) {
        proposalWhere.thematicAreas = {
          some: { thematicAreaId },
        };
      }

      // Get all thematic areas
      const areas = await db.thematicArea.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
          proposals: {
            where: Object.keys(proposalWhere).length > 0 ? proposalWhere : undefined,
            include: {
              client: { select: { id: true, name: true } },
              assignedMember: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Build summary by thematic area
      const byArea: Record<string, { count: number; totalValue: number; wonCount: number; wonValue: number; areaName: string; areaColor: string }> = {};
      const allProposals: Array<{
        id: string;
        name: string;
        rfpNumber: string;
        value: number;
        status: string;
        winningChances: string;
        focalPerson: string;
        followupDate: string | null;
        deadline: string | null;
        client: { id: string; name: string };
        assignedMember: { id: string; name: string } | null;
      }> = [];

      for (const area of areas) {
        byArea[area.id] = {
          count: area.proposals.length,
          totalValue: area.proposals.reduce((s, p) => s + p.value, 0),
          wonCount: area.proposals.filter((p) => p.status === "Won").length,
          wonValue: area.proposals.filter((p) => p.status === "Won").reduce((s, p) => s + p.value, 0),
          areaName: area.name,
          areaColor: area.color,
        };

        for (const proposal of area.proposals) {
          if (!allProposals.find((p) => p.id === proposal.id)) {
            allProposals.push(proposal as typeof allProposals[number]);
          }
        }
      }

      const totalProposals = allProposals.length;
      const totalValue = allProposals.reduce((s, p) => s + p.value, 0);
      const totalWon = allProposals.filter((p) => p.status === "Won").length;
      const wonValue = allProposals.filter((p) => p.status === "Won").reduce((s, p) => s + p.value, 0);

      return NextResponse.json({
        type: "thematic",
        totalRecords: totalProposals,
        summary: {
          totalAreas: areas.length,
          totalProposals,
          totalValue,
          totalWon,
          wonValue,
          winRate: totalProposals > 0 ? ((totalWon / totalProposals) * 100).toFixed(1) : "0",
          byArea,
        },
        data: {
          areas: areas.map((a) => ({
            id: a.id,
            name: a.name,
            color: a.color,
            proposalCount: a.proposals.length,
            totalValue: a.proposals.reduce((s, p) => s + p.value, 0),
          })),
          proposals: allProposals,
        },
      });
    }

    // Summary report (default)
    const totalClients = await db.client.count();
    const activeClients = await db.client.count({
      where: { status: "Active" },
    });
    const totalProposals = await db.proposal.count();

    const proposalWhere = buildProposalWhere();
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

    // Winning chances groups for summary
    const winningGroups: Record<string, { count: number; totalValue: number }> = {};
    for (const proposal of filteredProposals) {
      const wc = proposal.winningChances || "Not Set";
      if (!winningGroups[wc]) {
        winningGroups[wc] = { count: 0, totalValue: 0 };
      }
      winningGroups[wc].count += 1;
      winningGroups[wc].totalValue += proposal.value;
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
          byWinningChances: winningGroups,
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
