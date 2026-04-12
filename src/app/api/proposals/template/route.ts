import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const headers = [
    "Proposal Name *",
    "RFP Number",
    "Client *",
    "Assigned To",
    "Value (PKR)",
    "Status",
    "Winning Chances",
    "Focal Person",
    "Deadline",
    "Submission Date",
    "Follow-up Date",
    "Linked Proposal",
    "Remarks",
  ];

  const exampleRows = [
    [
      "Website Development for ECI",
      "RFP-2025-001",
      "ECI Foundation",
      "Ahmed Khan",
      1500000,
      "In Process",
      "High",
      "Mr. Ali Hassan",
      "2025-08-30",
      "2025-08-25",
      "2025-09-01",
      "",
      "Initial proposal for corporate website redesign",
    ],
    [
      "Mobile App for Health Dept",
      "RFP-2025-002",
      "Health Department",
      "Sara Malik",
      2500000,
      "Submitted",
      "Medium",
      "Dr. Fatima",
      "2025-09-15",
      "2025-09-10",
      "",
      "Website Development for ECI",
      "Health tracking mobile application",
    ],
  ];

  const data = [headers, ...exampleRows];
  const ws = XLSX.utils.aoa_to_sheet(data);

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
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
    { wch: 25 },
    { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Proposals Template");

  // Add instructions sheet
  const instructions = [
    ["ECI CRM - Proposal Import Template Instructions"],
    [""],
    ["HOW TO USE THIS TEMPLATE:"],
    [""],
    ["1. Fill in each row with one proposal's details."],
    ["2. Fields marked with * (Proposal Name, Client) are REQUIRED."],
    ["3. Delete the example rows before adding your data."],
    ["4. Save the file as .xlsx and upload it using the Import button."],
    [""],
    ["FIELD DESCRIPTIONS:"],
    [""],
    ['Proposal Name * : Full name/title of the proposal (required)'],
    ["RFP Number      : Reference number or tender ID"],
    ["Client *         : Name of the client organization (required)"],
    ["Assigned To      : Team member name (must exist in Team)"],
    ["Value (PKR)      : Numeric proposal value in PKR"],
    ["Status           : Submitted / In Process / In Evaluation / Pending / Won"],
    ["Winning Chances  : High / Medium / Low"],
    ["Focal Person     : Contact person at the client side"],
    ["Deadline         : Proposal deadline (YYYY-MM-DD)"],
    ["Submission Date  : Date of submission (YYYY-MM-DD)"],
    ["Follow-up Date   : Next follow-up date (YYYY-MM-DD)"],
    ["Linked Proposal  : Name of another proposal this is linked to"],
    ["Remarks          : Any additional notes"],
    [""],
    ["NOTES:"],
    ["- If a Client name does not exist, it will be created automatically."],
    ["- If a Team Member name is not found, the proposal will be unassigned."],
    ["- Linked proposals must already exist in the system."],
    ["- Date format: YYYY-MM-DD (e.g. 2025-08-30)"],
    ["- Rows with empty Proposal Name will be skipped."],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(instructions);
  ws2["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Instructions");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="ECI_CRM_Proposal_Template.xlsx"',
    },
  });
}
