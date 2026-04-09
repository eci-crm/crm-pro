import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Clean existing data ───────────────────────────────────────────
  await prisma.proposal.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.client.deleteMany();
  await prisma.setting.deleteMany();
  console.log("✅ Cleared existing data\n");

  // ─── 1. Clients ────────────────────────────────────────────────────
  const clientData = [
    { name: "Pakistan Telecommunication Company (PTCL)", address: "PTCL Towers, Blue Area, Islamabad", status: "Active" },
    { name: "National Bank of Pakistan", address: "NBP Building, Jinnah Avenue, Islamabad", status: "Active" },
    { name: "Sui Southern Gas Company", address: "SSGC House, Sir Shah Suleman Road, Karachi", status: "Active" },
    { name: "Pakistan Steel Mills", address: "Steel Town, Bin Qasim Town, Karachi", status: "Inactive" },
    { name: "Water and Power Development Authority (WAPDA)", address: "WAPDA House, Lahore", status: "Active" },
    { name: "Pakistan International Airlines (PIA)", address: "PIA Headquarters, Karachi Airport, Karachi", status: "Active" },
    { name: "Fauji Foundation", address: "Fauji Foundation Complex, The Mall, Rawalpindi", status: "Active" },
    { name: "Hub Power Company", address: "Hub Chowki, Lasbela, Balochistan", status: "Active" },
  ];

  const clients = [];
  for (const c of clientData) {
    const client = await prisma.client.create({ data: c });
    clients.push(client);
    console.log(`  🏢 Client: ${c.name} (${c.status})`);
  }
  console.log(`  ✅ ${clients.length} clients created\n`);

  // ─── 2. Team Members ───────────────────────────────────────────────
  const memberData = [
    { name: "Ahmed Khan", email: "ahmed@crmpro.com", role: "Manager" },
    { name: "Sara Ali", email: "sara@crmpro.com", role: "Member" },
    { name: "Usman Tariq", email: "usman@crmpro.com", role: "Member" },
    { name: "Fatima Noor", email: "fatima@crmpro.com", role: "Admin" },
    { name: "Bilal Ahmed", email: "bilal@crmpro.com", role: "Member" },
    { name: "Ayesha Siddiqui", email: "ayesha@crmpro.com", role: "Manager" },
  ];

  const members = [];
  for (const m of memberData) {
    const member = await prisma.teamMember.create({ data: m });
    members.push(member);
    console.log(`  👤 Team: ${m.name} (${m.role})`);
  }
  console.log(`  ✅ ${members.length} team members created\n`);

  // ─── 3. Proposals ──────────────────────────────────────────────────
  // Date helpers
  const today = new Date();
  const in2Days = addDays(2);      // urgent deadline (within 3 days)
  const in5Days = addDays(5);
  const in10Days = addDays(10);
  const in15Days = addDays(15);
  const in20Days = addDays(20);
  const in30Days = addDays(30);
  const in45Days = addDays(45);
  const in60Days = addDays(60);
  const past5Days = addDays(-5);
  const past15Days = addDays(-15);
  const past30Days = addDays(-30);

  const proposalData = [
    // ── Won (3) ──
    {
      name: "Network Infrastructure Upgrade",
      rfpNumber: "RFP-2024-001",
      clientId: clients[0].id,   // PTCL
      assignedMemberId: members[0].id, // Ahmed
      value: 15000000,
      status: "Won",
      remarks: "Upgrade nationwide fiber optic backbone for PTCL. Phase 1 approved.",
      deadline: past15Days,
      submissionDate: past30Days,
    },
    {
      name: "Core Banking System Modernization",
      rfpNumber: "RFP-2024-012",
      clientId: clients[1].id,   // NBP
      assignedMemberId: members[3].id, // Fatima
      value: 50000000,
      status: "Won",
      remarks: "Modernize legacy core banking platform to cloud-native architecture.",
      deadline: past5Days,
      submissionDate: past30Days,
    },
    {
      name: "SCADA System Implementation",
      rfpNumber: "TND-2024-007",
      clientId: clients[2].id,   // SSGC
      assignedMemberId: members[5].id, // Ayesha
      value: 8500000,
      status: "Won",
      remarks: "Supervisory control and data acquisition for gas pipeline monitoring.",
      deadline: past15Days,
      submissionDate: past30Days,
    },

    // ── In Process (4) ──
    {
      name: "ERP System Implementation",
      rfpNumber: "RFP-2024-018",
      clientId: clients[4].id,   // WAPDA
      assignedMemberId: members[1].id, // Sara
      value: 35000000,
      status: "In Process",
      remarks: "End-to-end ERP covering finance, HR, procurement, and asset management.",
      deadline: in20Days,
      submissionDate: past15Days,
    },
    {
      name: "Fleet Management Solution",
      rfpNumber: "TND-2024-022",
      clientId: clients[5].id,   // PIA
      assignedMemberId: members[2].id, // Usman
      value: 12000000,
      status: "In Process",
      remarks: "GPS-enabled fleet tracking and maintenance scheduling system.",
      deadline: in30Days,
      submissionDate: past5Days,
    },
    {
      name: "Agricultural Supply Chain Platform",
      rfpNumber: "RFP-2024-025",
      clientId: clients[6].id,   // Fauji Foundation
      assignedMemberId: members[4].id, // Bilal
      value: 7500000,
      status: "In Process",
      remarks: "Digital supply chain management for fertilizer and seed distribution.",
      deadline: in15Days,
      submissionDate: past5Days,
    },
    {
      name: "Cybersecurity Audit & Compliance",
      rfpNumber: "TND-2024-030",
      clientId: clients[0].id,   // PTCL
      assignedMemberId: members[0].id, // Ahmed
      value: 5000000,
      status: "In Process",
      remarks: "Comprehensive security audit, vulnerability assessment, and ISO 27001 compliance.",
      deadline: in10Days,
      submissionDate: today,
    },

    // ── Submitted (3) ──
    {
      name: "Power Grid Monitoring Dashboard",
      rfpNumber: "RFP-2024-028",
      clientId: clients[7].id,   // Hub Power
      assignedMemberId: members[5].id, // Ayesha
      value: 9800000,
      status: "Submitted",
      remarks: "Real-time power grid monitoring with predictive maintenance analytics.",
      deadline: in45Days,
      submissionDate: today,
    },
    {
      name: "HR Management Portal",
      rfpNumber: "TND-2024-015",
      clientId: clients[1].id,   // NBP
      assignedMemberId: members[3].id, // Fatima
      value: 4500000,
      status: "Submitted",
      remarks: "Employee self-service portal with leave, payroll, and performance modules.",
      deadline: in60Days,
      submissionDate: today,
    },
    {
      name: "Gas Distribution Management System",
      rfpNumber: "RFP-2024-032",
      clientId: clients[2].id,   // SSGC
      assignedMemberId: members[1].id, // Sara
      value: 18500000,
      status: "Submitted",
      remarks: "End-to-end gas distribution management including billing and leakage detection.",
      deadline: in45Days,
      submissionDate: addDays(-1),
    },

    // ── In Evaluation (2) ──
    {
      name: "Customer Relationship Management Platform",
      rfpNumber: "TND-2024-019",
      clientId: clients[5].id,   // PIA
      assignedMemberId: members[2].id, // Usman
      value: 6200000,
      status: "In Evaluation",
      remarks: "Unified CRM for loyalty programs, booking support, and customer analytics.",
      deadline: in10Days,
      submissionDate: past15Days,
    },
    {
      name: "Steel Production Optimization Suite",
      rfpNumber: "RFP-2024-005",
      clientId: clients[3].id,   // Pakistan Steel Mills
      assignedMemberId: members[4].id, // Bilal
      value: 28000000,
      status: "In Evaluation",
      remarks: "IoT-based production line monitoring with quality assurance dashboards.",
      deadline: in20Days,
      submissionDate: past15Days,
    },

    // ── Pending (2) ──
    {
      name: "Data Center Migration Strategy",
      rfpNumber: "TND-2024-035",
      clientId: clients[0].id,   // PTCL
      assignedMemberId: members[0].id, // Ahmed
      value: 22000000,
      status: "Pending",
      remarks: "Migration of on-premise data centers to hybrid cloud infrastructure.",
      deadline: in60Days,
      submissionDate: null,
    },
    {
      name: "Smart Metering Infrastructure",
      rfpNumber: "RFP-2024-040",
      clientId: clients[4].id,   // WAPDA
      assignedMemberId: members[5].id, // Ayesha
      value: 42000000,
      status: "Pending",
      remarks: "AMI smart meter deployment plan covering 500,000 connections in Lahore.",
      deadline: in60Days,
      submissionDate: null,
    },

    // ── Urgent: deadline within 3 days ──
    {
      name: "Disaster Recovery Planning",
      rfpNumber: "RFP-2024-042",
      clientId: clients[1].id,   // NBP
      assignedMemberId: members[3].id, // Fatima
      value: 3500000,
      status: "Submitted",
      remarks: "Business continuity and disaster recovery plan for all NBP branches nationwide.",
      deadline: in2Days,
      submissionDate: past15Days,
    },
  ];

  // Adjust: we have 3 Won + 4 In Process + 3 Submitted (incl urgent) + 2 In Evaluation + 2 Pending = 14
  // Add one more Submitted to reach 15 total proposals (keeps required counts correct)
  // Actually let me recount:
  // Won: 3, In Process: 4, Submitted: 4 (including urgent one), In Evaluation: 2, Pending: 2 = 15 total ✓
  // Requirements: 3 Won ✓, 4 In Process ✓, 3 Submitted ✓ (4 submitted but that's fine, more is ok)
  // 2 In Evaluation ✓, 2 Pending ✓, 1 deadline within 3 days ✓

  const proposals = [];
  for (const p of proposalData) {
    const proposal = await prisma.proposal.create({
      data: {
        name: p.name,
        rfpNumber: p.rfpNumber,
        clientId: p.clientId,
        assignedMemberId: p.assignedMemberId,
        value: p.value,
        status: p.status,
        remarks: p.remarks,
        deadline: p.deadline,
        submissionDate: p.submissionDate,
      },
    });
    proposals.push(proposal);
    const daysLabel = p.deadline
      ? p.deadline < today
        ? "OVERDUE"
        : `${Math.ceil((p.deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))}d left`
      : "No deadline";
    console.log(`  📋 [${p.status}] ${p.name} — PKR ${(p.value / 1000000).toFixed(1)}M (${daysLabel})`);
  }
  console.log(`  ✅ ${proposals.length} proposals created\n`);

  // ─── 4. Settings ───────────────────────────────────────────────────
  const settingData = [
    { key: "companyName", value: "CRM Pro Solutions" },
    { key: "tagline", value: "Empowering Business Growth" },
    { key: "logo", value: "" },
  ];

  for (const s of settingData) {
    await prisma.setting.create({ data: s });
    console.log(`  ⚙️  Setting: ${s.key} = "${s.value}"`);
  }
  console.log(`  ✅ ${settingData.length} settings created\n`);

  // ─── Summary ───────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════");
  console.log("  🎉 Seed completed successfully!");
  console.log(`  🏢 Clients:    ${clients.length}`);
  console.log(`  👤 Team:       ${members.length}`);
  console.log(`  📋 Proposals:  ${proposals.length}`);
  console.log(`  ⚙️  Settings:   ${settingData.length}`);
  console.log("═══════════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
