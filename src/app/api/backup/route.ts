import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Export all data from all tables
    const [
      clients,
      teamMembers,
      thematicAreas,
      proposals,
      proposalThematicAreas,
      resources,
      resourceFolders,
      settings,
    ] = await Promise.all([
      db.client.findMany({ orderBy: { createdAt: "asc" } }),
      db.teamMember.findMany({ orderBy: { createdAt: "asc" } }),
      db.thematicArea.findMany({ orderBy: { sortOrder: "asc" } }),
      db.proposal.findMany({ orderBy: { createdAt: "asc" } }),
      db.proposalThematicArea.findMany(),
      db.resource.findMany({ orderBy: { createdAt: "asc" } }),
      db.resourceFolder.findMany({ orderBy: { createdAt: "asc" } }),
      db.setting.findMany(),
    ]);

    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      data: {
        clients,
        teamMembers,
        thematicAreas,
        proposals,
        proposalThematicAreas,
        resources,
        resourceFolders,
        settings,
      },
    };

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="crm-backup-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Error creating backup:", error);
    return NextResponse.json(
      { error: "Failed to create backup" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate structure
    if (!body.version || !body.data) {
      return NextResponse.json(
        { error: "Invalid backup file format" },
        { status: 400 }
      );
    }

    const {
      clients,
      teamMembers,
      thematicAreas,
      proposals,
      proposalThematicAreas,
      resources,
      resourceFolders,
      settings,
    } = body.data;

    // Use a transaction for atomicity
    const result = await db.$transaction(async (tx) => {
      const stats = {
        clients: 0,
        teamMembers: 0,
        thematicAreas: 0,
        proposals: 0,
        proposalThematicAreas: 0,
        resources: 0,
        resourceFolders: 0,
        settings: 0,
      };

      // Build ID mappings to handle ID changes
      const clientMap = new Map<string, string>();
      const memberMap = new Map<string, string>();
      const areaMap = new Map<string, string>();
      const proposalMap = new Map<string, string>();
      const folderMap = new Map<string, string>();

      // 1. Settings
      if (Array.isArray(settings) && settings.length > 0) {
        for (const setting of settings) {
          await tx.setting.upsert({
            where: { key: setting.key },
            update: { value: setting.value },
            create: { key: setting.key, value: setting.value },
          });
          stats.settings++;
        }
      }

      // 2. Team Members (needed before proposals)
      if (Array.isArray(teamMembers) && teamMembers.length > 0) {
        for (const member of teamMembers) {
          const created = await tx.teamMember.create({
            data: {
              name: member.name,
              email: member.email,
              password: member.password || "",
              role: member.role || "Member",
              isActive: member.isActive ?? true,
            },
          });
          memberMap.set(member.id, created.id);
          stats.teamMembers++;
        }
      }

      // 3. Clients
      if (Array.isArray(clients) && clients.length > 0) {
        for (const client of clients) {
          const created = await tx.client.create({
            data: {
              name: client.name,
              address: client.address || "",
              status: client.status || "Active",
              createdAt: client.createdAt ? new Date(client.createdAt) : undefined,
              updatedAt: client.updatedAt ? new Date(client.updatedAt) : undefined,
            },
          });
          clientMap.set(client.id, created.id);
          stats.clients++;
        }
      }

      // 4. Thematic Areas
      if (Array.isArray(thematicAreas) && thematicAreas.length > 0) {
        for (const area of thematicAreas) {
          const created = await tx.thematicArea.create({
            data: {
              name: area.name,
              color: area.color || "#3b82f6",
              sortOrder: area.sortOrder ?? 0,
            },
          });
          areaMap.set(area.id, created.id);
          stats.thematicAreas++;
        }
      }

      // 5. Proposals
      if (Array.isArray(proposals) && proposals.length > 0) {
        for (const proposal of proposals) {
          const created = await tx.proposal.create({
            data: {
              name: proposal.name,
              rfpNumber: proposal.rfpNumber || "",
              clientId: clientMap.get(proposal.clientId) || proposal.clientId,
              assignedMemberId: memberMap.get(proposal.assignedMemberId) || null,
              value: proposal.value ?? 0,
              status: proposal.status || "In Process",
              remarks: proposal.remarks || "",
              deadline: proposal.deadline ? new Date(proposal.deadline) : null,
              submissionDate: proposal.submissionDate
                ? new Date(proposal.submissionDate)
                : null,
              createdAt: proposal.createdAt
                ? new Date(proposal.createdAt)
                : undefined,
              updatedAt: proposal.updatedAt
                ? new Date(proposal.updatedAt)
                : undefined,
            },
          });
          proposalMap.set(proposal.id, created.id);
          stats.proposals++;
        }
      }

      // 6. Proposal Thematic Areas (junction table)
      if (
        Array.isArray(proposalThematicAreas) &&
        proposalThematicAreas.length > 0
      ) {
        for (const pta of proposalThematicAreas) {
          const newProposalId = proposalMap.get(pta.proposalId);
          const newAreaId = areaMap.get(pta.thematicAreaId);
          if (newProposalId && newAreaId) {
            await tx.proposalThematicArea.create({
              data: {
                proposalId: newProposalId,
                thematicAreaId: newAreaId,
              },
            });
            stats.proposalThematicAreas++;
          }
        }
      }

      // 7. Resource Folders
      if (Array.isArray(resourceFolders) && resourceFolders.length > 0) {
        // First create root folders, then children (respecting parent order)
        const rootFolders = resourceFolders.filter((f: { parentId: string | null }) => !f.parentId);
        const childFolders = resourceFolders.filter((f: { parentId: string | null }) => f.parentId);

        for (const folder of rootFolders) {
          const created = await tx.resourceFolder.create({
            data: {
              name: folder.name,
              createdAt: folder.createdAt ? new Date(folder.createdAt) : undefined,
              updatedAt: folder.updatedAt ? new Date(folder.updatedAt) : undefined,
            },
          });
          folderMap.set(folder.id, created.id);
          stats.resourceFolders++;
        }

        // Now handle child folders (may need multiple passes for deep nesting)
        const remaining = [...childFolders];
        let maxPasses = 10;
        while (remaining.length > 0 && maxPasses > 0) {
          maxPasses--;
          for (let i = remaining.length - 1; i >= 0; i--) {
            const folder = remaining[i];
            const newParentId = folderMap.get(folder.parentId);
            if (newParentId) {
              const created = await tx.resourceFolder.create({
                data: {
                  name: folder.name,
                  parentId: newParentId,
                  createdAt: folder.createdAt ? new Date(folder.createdAt) : undefined,
                  updatedAt: folder.updatedAt ? new Date(folder.updatedAt) : undefined,
                },
              });
              folderMap.set(folder.id, created.id);
              stats.resourceFolders++;
              remaining.splice(i, 1);
            }
          }
        }
      }

      // 8. Resources
      if (Array.isArray(resources) && resources.length > 0) {
        for (const resource of resources) {
          await tx.resource.create({
            data: {
              name: resource.name,
              filePath: resource.filePath || resource.name,
              fileType: resource.fileType || "",
              fileSize: resource.fileSize || 0,
              fileData: resource.fileData || "",
              folderId: folderMap.get(resource.folderId) || null,
              createdAt: resource.createdAt
                ? new Date(resource.createdAt)
                : undefined,
              updatedAt: resource.updatedAt
                ? new Date(resource.updatedAt)
                : undefined,
            },
          });
          stats.resources++;
        }
      }

      return stats;
    });

    return NextResponse.json({
      message: "Backup imported successfully",
      stats: result,
    });
  } catch (error) {
    console.error("Error importing backup:", error);
    return NextResponse.json(
      { error: "Failed to import backup. " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 }
    );
  }
}
