import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId") || "";
    const status = searchParams.get("status") || "";
    const winningChances = searchParams.get("winningChances") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const search = searchParams.get("search") || "";

    // Build filter
    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (winningChances) where.winningChances = winningChances;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { rfpNumber: { contains: search } },
        { remarks: { contains: search } },
        { focalPerson: { contains: search } },
      ];
    }
    if (startDate || endDate) {
      const deadlineFilter: Record<string, unknown> = {};
      if (startDate) deadlineFilter.gte = new Date(startDate);
      if (endDate) deadlineFilter.lte = new Date(endDate);
      where.deadline = deadlineFilter;
    }

    const proposals = await db.proposal.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, status: true } },
        assignedMember: { select: { id: true, name: true, email: true, role: true } },
        thematicAreas: { include: { thematicArea: { select: { id: true, name: true, color: true } } } },
      },
    });

    // Build export data
    const exportData = proposals.map((p) => ({
      "Proposal Name": p.name,
      "RFP Number": p.rfpNumber,
      Client: p.client?.name || "",
      "Assigned To": p.assignedMember?.name || "",
      "Value (PKR)": p.value,
      Status: p.status,
      "Winning Chances": p.winningChances || "Not Set",
      "Focal Person": p.focalPerson || "",
      "Deadline": p.deadline ? new Date(p.deadline).toLocaleDateString("en-US") : "",
      "Submission Date": p.submissionDate ? new Date(p.submissionDate).toLocaleDateString("en-US") : "",
      "Follow-up Date": p.followupDate ? new Date(p.followupDate).toLocaleDateString("en-US") : "",
      Remarks: p.remarks,
      "Thematic Areas": p.thematicAreas?.map((ta) => ta.thematicArea.name).join(", ") || "",
    }));

    if (exportData.length === 0) {
      return NextResponse.json(
        { error: "No proposals to export matching the current filters" },
        { status: 404 }
      );
    }

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    ws["!cols"] = [
      { wch: 35 },
      { wch: 18 },
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 40 },
      { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proposals");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const timestamp = new Date().toISOString().split("T")[0];
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          `attachment; filename="CRM_Proposals_Export_${timestamp}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting proposals:", error);
    return NextResponse.json(
      { error: "Failed to export proposals" },
      { status: 500 }
    );
  }
}
