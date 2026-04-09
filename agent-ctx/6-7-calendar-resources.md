# Task 6-7: Calendar & Resources Pages

**Date**: 2025-06-05
**Status**: ✅ Completed

## Summary
Implemented two full CRM pages: a custom-built monthly Calendar page for viewing proposal deadlines, and a Resources page for file upload/management.

## Files Modified

### 1. `src/components/crm/calendar.tsx` (replaced placeholder)
- **Custom Monthly Calendar Grid**: 7-column grid (`grid-cols-7`) with 5-6 week rows, each cell `min-h-[80px] p-1` with border styling
- **Navigation**: Previous/Next month buttons with `addMonths`/`subMonths`, "Today" button to reset view, current month/year header display
- **Proposal Events on Calendar**: Fetches all proposals via `/api/proposals`, filters by deadline, displays as colored bars on calendar dates (max 3 visible with "+N more" overflow)
- **Event List Sidebar**: Shows events for selected date or entire visible month, scrollable with `ScrollArea`, sorted by date
- **Event Details Dialog**: Click any event to see full proposal details (name, status badge, client, value, deadline, assigned member, RFP number, remarks)
- **Color Coding by Status**: Submitted=blue, Won=emerald, In Process=amber, In Evaluation=purple, Pending=orange, Lost=red (consistent with proposal page conventions)
- **Upcoming Deadlines Panel**: Top card showing next 5 upcoming deadlines as clickable cards, navigates calendar to that date
- **date-fns Usage**: `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `format`, `isSameMonth`, `isToday`, `addMonths`, `subMonths`, `startOfWeek`, `endOfWeek`, `isSameDay`, `parseISO`, `isAfter`, `isBefore`
- **Responsive**: Calendar scrollable on mobile, sidebar stacks below on smaller screens (`lg:grid-cols-[1fr_340px]`)
- **Loading states**: Skeleton loaders for calendar grid and upcoming deadlines
- **Uses**: `@tanstack/react-query`, `sonner` toasts, `shadcn/ui` (Card, Button, Badge, Dialog, Skeleton, ScrollArea, Separator), `lucide-react` icons

### 2. `src/components/crm/resources.tsx` (replaced placeholder)
- **Drag-and-Drop Upload Zone**: Full drag/drop support with `onDragOver`/`onDragLeave`/`onDrop` handlers, visual feedback when dragging, click-to-browse fallback, multiple file support
- **File List Table**: Responsive `Table` showing file name, type badge, size, upload date, and action buttons; columns progressively hidden on smaller screens (type hidden on mobile, size on sm, date on md)
- **Download**: Creates blob URL from API response, triggers download with `document.createElement('a')` preserving original filename via `Content-Disposition`
- **Delete**: Confirmation `AlertDialog` with destructive action button, loading spinner during deletion
- **File Type Icons**: Category detection based on MIME type and extension, 10 categories (PDF, document, spreadsheet, presentation, image, audio, video, archive, code, other) each with unique Lucide icon and color
- **File Type Badges**: Extension shown in colored badge matching category (e.g., PDF=red, DOC=blue, XLS=emerald)
- **File Size Formatting**: Proper KB/MB/GB formatting as specified
- **File Category Detection**: `getFileCategory()` analyzes both MIME type and extension to determine category
- **Uses**: `@tanstack/react-query` (query + mutation), `sonner` toasts, `shadcn/ui` (Card, Button, Badge, Table, Skeleton, AlertDialog), `lucide-react` icons

## Lint Results
- Calendar page: **0 errors, 0 warnings**
- Resources page: **0 errors, 0 warnings** (fixed `Image` import alias to `ImageIcon` to avoid jsx-a11y false positive)
- Pre-existing issues in `proposals.tsx` and `settings.tsx` remain unchanged

## Technical Notes
- Both pages are `'use client'` components
- Both use `@tanstack/react-query` for data fetching and mutations
- Both handle loading/error states with skeletons and toast notifications
- Calendar page fetches all proposals client-side and filters by deadline locally
- Resources page uses proper `FormData` for file uploads
- No external calendar library used — clean custom implementation
