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
  await prisma.proposalThematicArea.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.client.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.thematicArea.deleteMany();
  console.log("✅ Cleared existing data\n");

  // ─── 0. Thematic Areas ─────────────────────────────────────────────
  const areaData = [
    { name: "Information Technology", color: "#3b82f6", sortOrder: 0 },
    { name: "Cybersecurity", color: "#8b5cf6", sortOrder: 1 },
    { name: "Cloud Infrastructure", color: "#06b6d4", sortOrder: 2 },
    { name: "ERP Systems", color: "#f59e0b", sortOrder: 3 },
    { name: "Data Analytics", color: "#10b981", sortOrder: 4 },
    { name: "Networking & Telecom", color: "#ec4899", sortOrder: 5 },
    { name: "Financial Systems", color: "#ef4444", sortOrder: 6 },
    { name: "SCADA & IoT", color: "#f97316", sortOrder: 7 },
    { name: "Supply Chain", color: "#14b8a6", sortOrder: 8 },
    { name: "HR & Workforce", color: "#6366f1", sortOrder: 9 },
    { name: "Fleet Management", color: "#84cc16", sortOrder: 10 },
    { name: "Power & Energy", color: "#eab308", sortOrder: 11 },
  ];

  const thematicAreas = [];
  for (const a of areaData) {
    const area = await prisma.thematicArea.create({ data: a });
    thematicAreas.push(area);
    console.log(`  🏷️  Area: ${a.name}`);
  }
  console.log(`  ✅ ${thematicAreas.length} thematic areas created\n`);

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

  // ─── 2. Team Members (with passwords) ─────────────────────────────
  const memberData = [
    { name: "Ahmed Khan", email: "ahmed@crmpro.com", password: "admin123", role: "Admin" },
    { name: "Sara Ali", email: "sara@crmpro.com", password: "member123", role: "Member" },
    { name: "Usman Tariq", email: "usman@crmpro.com", password: "member123", role: "Member" },
    { name: "Fatima Noor", email: "fatima@crmpro.com", password: "manager123", role: "Manager" },
    { name: "Bilal Ahmed", email: "bilal@crmpro.com", password: "member123", role: "Member" },
    { name: "Ayesha Siddiqui", email: "ayesha@crmpro.com", password: "manager123", role: "Manager" },
  ];

  const members = [];
  for (const m of memberData) {
    const member = await prisma.teamMember.create({ data: m });
    members.push(member);
    console.log(`  👤 Team: ${m.name} (${m.role}) — ${m.email}`);
  }
  console.log(`  ✅ ${members.length} team members created\n`);

  // ─── 3. Proposals with Thematic Areas ─────────────────────────────
  const today = new Date();
  const in2Days = addDays(2);
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
    {
      name: "Network Infrastructure Upgrade",
      rfpNumber: "RFP-2024-001", clientId: clients[0].id, assignedMemberId: members[0].id,
      value: 15000000, status: "Won", winningChances: "High", focalPerson: "Imran Sheikh",
      remarks: "Upgrade nationwide fiber optic backbone for PTCL. Phase 1 approved.",
      deadline: past15Days, submissionDate: past30Days, followupDate: null,
      thematicAreas: [0, 5], // IT, Networking
    },
    {
      name: "Core Banking System Modernization",
      rfpNumber: "RFP-2024-012", clientId: clients[1].id, assignedMemberId: members[3].id,
      value: 50000000, status: "Won", winningChances: "High", focalPerson: "Tariq Mehmood",
      remarks: "Modernize legacy core banking platform to cloud-native architecture.",
      deadline: past5Days, submissionDate: past30Days, followupDate: null,
      thematicAreas: [6, 2], // Financial, Cloud
    },
    {
      name: "SCADA System Implementation",
      rfpNumber: "TND-2024-007", clientId: clients[2].id, assignedMemberId: members[5].id,
      value: 8500000, status: "Won", winningChances: "Medium", focalPerson: "Rashid Khan",
      remarks: "Supervisory control and data acquisition for gas pipeline monitoring.",
      deadline: past15Days, submissionDate: past30Days, followupDate: in5Days,
      thematicAreas: [7, 0], // SCADA, IT
    },
    {
      name: "ERP System Implementation",
      rfpNumber: "RFP-2024-018", clientId: clients[4].id, assignedMemberId: members[1].id,
      value: 35000000, status: "In Process", winningChances: "Medium", focalPerson: "Kamran Raza",
      remarks: "End-to-end ERP covering finance, HR, procurement, and asset management.",
      deadline: in20Days, submissionDate: past15Days, followupDate: in10Days,
      thematicAreas: [3, 0], // ERP, IT
    },
    {
      name: "Fleet Management Solution",
      rfpNumber: "TND-2024-022", clientId: clients[5].id, assignedMemberId: members[2].id,
      value: 12000000, status: "In Process", winningChances: "Low", focalPerson: "Nasir Hussain",
      remarks: "GPS-enabled fleet tracking and maintenance scheduling system.",
      deadline: in30Days, submissionDate: past5Days, followupDate: in15Days,
      thematicAreas: [10, 7], // Fleet, IoT
    },
    {
      name: "Agricultural Supply Chain Platform",
      rfpNumber: "RFP-2024-025", clientId: clients[6].id, assignedMemberId: members[4].id,
      value: 7500000, status: "In Process", winningChances: "Medium", focalPerson: "Zainab Malik",
      remarks: "Digital supply chain management for fertilizer and seed distribution.",
      deadline: in15Days, submissionDate: past5Days, followupDate: in2Days,
      thematicAreas: [8, 4], // Supply Chain, Data Analytics
    },
    {
      name: "Cybersecurity Audit & Compliance",
      rfpNumber: "TND-2024-030", clientId: clients[0].id, assignedMemberId: members[0].id,
      value: 5000000, status: "In Process", winningChances: "High", focalPerson: "Waqar Ahmed",
      remarks: "Comprehensive security audit, vulnerability assessment, and ISO 27001 compliance.",
      deadline: in10Days, submissionDate: today, followupDate: in5Days,
      thematicAreas: [1, 0], // Cybersecurity, IT
    },
    {
      name: "Power Grid Monitoring Dashboard",
      rfpNumber: "RFP-2024-028", clientId: clients[7].id, assignedMemberId: members[5].id,
      value: 9800000, status: "Submitted", winningChances: "Medium", focalPerson: "Adnan Shah",
      remarks: "Real-time power grid monitoring with predictive maintenance analytics.",
      deadline: in45Days, submissionDate: today, followupDate: null,
      thematicAreas: [11, 4], // Power, Data Analytics
    },
    {
      name: "HR Management Portal",
      rfpNumber: "TND-2024-015", clientId: clients[1].id, assignedMemberId: members[3].id,
      value: 4500000, status: "Submitted", winningChances: "Low", focalPerson: "Hina Javed",
      remarks: "Employee self-service portal with leave, payroll, and performance modules.",
      deadline: in60Days, submissionDate: today, followupDate: in20Days,
      thematicAreas: [9, 3], // HR, ERP
    },
    {
      name: "Gas Distribution Management System",
      rfpNumber: "RFP-2024-032", clientId: clients[2].id, assignedMemberId: members[1].id,
      value: 18500000, status: "Submitted", winningChances: "High", focalPerson: "Shahid Iqbal",
      remarks: "End-to-end gas distribution management including billing and leakage detection.",
      deadline: in45Days, submissionDate: addDays(-1), followupDate: in10Days,
      thematicAreas: [7, 2], // SCADA, Cloud
    },
    {
      name: "Customer Relationship Management Platform",
      rfpNumber: "TND-2024-019", clientId: clients[5].id, assignedMemberId: members[2].id,
      value: 6200000, status: "In Evaluation", winningChances: "Medium", focalPerson: "Amir Bukhari",
      remarks: "Unified CRM for loyalty programs, booking support, and customer analytics.",
      deadline: in10Days, submissionDate: past15Days, followupDate: in2Days,
      thematicAreas: [4, 3], // Data Analytics, ERP
    },
    {
      name: "Steel Production Optimization Suite",
      rfpNumber: "RFP-2024-005", clientId: clients[3].id, assignedMemberId: members[4].id,
      value: 28000000, status: "In Evaluation", winningChances: "Low", focalPerson: "Farhan Ali",
      remarks: "IoT-based production line monitoring with quality assurance dashboards.",
      deadline: in20Days, submissionDate: past15Days, followupDate: null,
      thematicAreas: [7, 4], // IoT, Data Analytics
    },
    {
      name: "Data Center Migration Strategy",
      rfpNumber: "TND-2024-035", clientId: clients[0].id, assignedMemberId: members[0].id,
      value: 22000000, status: "Pending", winningChances: "", focalPerson: "",
      remarks: "Migration of on-premise data centers to hybrid cloud infrastructure.",
      deadline: in60Days, submissionDate: null, followupDate: null,
      thematicAreas: [2, 0], // Cloud, IT
    },
    {
      name: "Smart Metering Infrastructure",
      rfpNumber: "RFP-2024-040", clientId: clients[4].id, assignedMemberId: members[5].id,
      value: 42000000, status: "Pending", winningChances: "", focalPerson: "",
      remarks: "AMI smart meter deployment plan covering 500,000 connections in Lahore.",
      deadline: in60Days, submissionDate: null, followupDate: null,
      thematicAreas: [7, 11], // IoT, Power
    },
    {
      name: "Disaster Recovery Planning",
      rfpNumber: "RFP-2024-042", clientId: clients[1].id, assignedMemberId: members[3].id,
      value: 3500000, status: "Submitted", winningChances: "High", focalPerson: "Sana Rafiq",
      remarks: "Business continuity and disaster recovery plan for all NBP branches nationwide.",
      deadline: in2Days, submissionDate: past15Days, followupDate: today,
      thematicAreas: [1, 2], // Cybersecurity, Cloud
    },
  ];

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
        winningChances: p.winningChances || "",
        focalPerson: p.focalPerson || "",
        remarks: p.remarks,
        deadline: p.deadline,
        submissionDate: p.submissionDate,
        followupDate: p.followupDate || null,
        thematicAreas: {
          create: p.thematicAreas.map((areaIdx) => ({
            thematicAreaId: thematicAreas[areaIdx].id,
          })),
        },
      },
      include: { thematicAreas: true },
    });
    proposals.push(proposal);
    const areaNames = p.thematicAreas.map((i) => thematicAreas[i].name).join(", ");
    console.log(`  📋 [${p.status}] ${p.name} — Areas: ${areaNames}`);
  }
  console.log(`  ✅ ${proposals.length} proposals created\n`);

  // ─── 4. Settings ───────────────────────────────────────────────────
  const settingData = [
    { key: "companyName", value: "CRM Pro Solutions" },
    { key: "companyTagline", value: "Empowering Business Growth" },
    { key: "companyLogo", value: "" },
  ];

  for (const s of settingData) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log(`  ✅ ${settingData.length} settings upserted\n`);

  // ─── Summary ───────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════");
  console.log("  🎉 Seed completed successfully!");
  console.log(`  🏷️  Areas:     ${thematicAreas.length}`);
  console.log(`  🏢 Clients:    ${clients.length}`);
  console.log(`  👤 Team:       ${members.length}`);
  console.log(`  📋 Proposals:  ${proposals.length}`);
  console.log(`  ⚙️  Settings:   ${settingData.length}`);
  console.log("═══════════════════════════════════════════════");
  console.log("\n  🔑 Login credentials:");
  for (const m of memberData) {
    console.log(`     ${m.email} / ${m.password} (${m.role})`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
