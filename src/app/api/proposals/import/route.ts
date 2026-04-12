import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "The uploaded file has no sheets." },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    if (!rows.length) {
      return NextResponse.json(
        { error: "The uploaded file is empty." },
        { status: 400 }
      );
    }

    // Preload clients and team members for lookup
    const clients = await db.client.findMany();
    const members = await db.teamMember.findMany();
    const existingProposals = await db.proposal.findMany({
      select: { id: true, name: true },
    });

    const clientMap = new Map(clients.map((c) => [c.name.toLowerCase(), c.id]));
    const memberMap = new Map(members.map((m) => [m.name.toLowerCase(), m.id]));

    let created = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header row

      // Skip completely empty rows
      const name = String(row["Proposal Name"] ?? row["proposal_name"] ?? row["Name"] ?? "").trim();
      if (!name) {
        skipped++;
        continue;
      }

      try {
        const clientName = String(
          row["Client"] ?? row["client"] ?? row["Client Name"] ?? ""
        ).trim();

        if (!clientName) {
          errors.push(`Row ${rowNum}: Client name is required.`);
          continue;
        }

        let clientId = clientMap.get(clientName.toLowerCase());
        if (!clientId) {
          // Auto-create client if not found
          const newClient = await db.client.create({
            data: { name: clientName },
          });
          clientId = newClient.id;
          clientMap.set(clientName.toLowerCase(), clientId);
        }

        const memberName = String(
          row["Assigned To"] ?? row["assigned_to"] ?? row["Team Member"] ?? ""
        ).trim();
        let assignedMemberId = "";
        if (memberName) {
          assignedMemberId =
            memberMap.get(memberName.toLowerCase()) || "";
        }

        const statusVal = String(
          row["Status"] ?? row["status"] ?? "In Process"
        ).trim();
        const validStatuses = ["Submitted", "In Process", "In Evaluation", "Pending", "Won"];
        const status = validStatuses.includes(statusVal) ? statusVal : "In Process";

        const winningVal = String(
          row["Winning Chances"] ?? row["winning_chances"] ?? ""
        ).trim();
        const validWinning = ["High", "Medium", "Low"];
        const winningChances = validWinning.includes(winningVal) ? winningVal : "";

        const focalPerson = String(
          row["Focal Person"] ?? row["focal_person"] ?? ""
        ).trim();

        const valueStr = String(
          row["Value"] ?? row["value"] ?? row["Amount"] ?? "0"
        ).replace(/[^0-9.\-]/g, "");
        const value = parseFloat(valueStr) || 0;

        const rfpNumber = String(
          row["RFP Number"] ?? row["rfp_number"] ?? ""
        ).trim();

        const remarks = String(
          row["Remarks"] ?? row["remarks"] ?? row["Notes"] ?? ""
        ).trim();

        const deadlineStr = String(
          row["Deadline"] ?? row["deadline"] ?? ""
        ).trim();
        const deadline = deadlineStr ? parseDateField(deadlineStr) : null;

        const submissionStr = String(
          row["Submission Date"] ?? row["submission_date"] ?? ""
        ).trim();
        const submissionDate = submissionStr ? parseDateField(submissionStr) : null;

        const followupStr = String(
          row["Follow-up Date"] ?? row["followup_date"] ?? ""
        ).trim();
        const followupDate = followupStr ? parseDateField(followupStr) : null;

        const linkedName = String(
          row["Linked Proposal"] ?? row["linked_proposal"] ?? ""
        ).trim();
        let linkedProposalId: string | null = null;
        if (linkedName) {
          const linked = existingProposals.find(
            (p) => p.name.toLowerCase() === linkedName.toLowerCase()
          );
          if (linked) linkedProposalId = linked.id;
        }

        await db.proposal.create({
          data: {
            name,
            rfpNumber,
            clientId,
            assignedMemberId,
            value,
            status,
            winningChances,
            focalPerson,
            remarks,
            deadline,
            submissionDate,
            followupDate,
            linkedProposalId,
          },
        });

        created++;
      } catch (err) {
        errors.push(
          `Row ${rowNum}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import completed: ${created} proposal(s) created, ${skipped} skipped.`,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error importing proposals:", error);
    return NextResponse.json(
      { error: "Failed to import proposals. Please check the file format." },
      { status: 500 }
    );
  }
}

function parseDateField(val: string): Date | null {
  if (!val) return null;
  // Try parsing various date formats
  // If it's a number from Excel (days since epoch)
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    return date;
  }
  // Try ISO format or other parsable formats
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
}
