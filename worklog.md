---
Task ID: 1
Agent: Main Agent
Task: Fix "Failed to load proposals" error and add Excel import functionality

Work Log:
- Diagnosed root cause: Prisma schema had `provider = "postgresql"` but `.env` had `DATABASE_URL=file:./db/custom.db` (SQLite)
- Fixed `prisma/schema.prisma`: changed provider from "postgresql" to "sqlite"
- Fixed `.env`: ensured `DATABASE_URL=file:./db/custom.db`
- Ran `bun run db:push` — database was already in sync
- Removed verbose `log: ['query']` from `src/lib/db.ts` to reduce noise
- Installed `xlsx` npm package (v0.18.5) for Excel parsing
- Created `src/app/api/proposals/import/route.ts` — POST endpoint that accepts Excel/CSV files, parses rows, auto-creates clients, creates proposals with all fields (winning chances, focal person, follow-up date, linked proposal, etc.)
- Created `src/app/api/proposals/template/route.ts` — GET endpoint that generates and downloads an Excel template with proper column headers, example data, and an Instructions sheet
- Updated `src/components/crm/proposals.tsx`:
  - Added import icons (Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2)
  - Added import dialog state (importDialogOpen, importFile, importResult)
  - Added importMutation using useMutation
  - Added "Import" button next to "Add Proposal" button in header
  - Added full Import Dialog with 2-step flow: (1) Download Template, (2) Upload file
  - Import dialog shows file preview, loading state during import, and results (created count, skipped, errors)
- Verified reports section already has winning chances filter in both API (`/api/reports/route.ts`) and UI (`reports.tsx`)
- Ran `bun run lint` — no errors

Stage Summary:
- Fixed the critical database mismatch that caused "Failed to load proposals" error
- Added complete Excel import feature with template download
- Reports section already supports winning chances filtering from previous session
- All existing features (Winning Chances, Focal Person, Follow-up Date, Linked Proposal) are working in the proposal form
