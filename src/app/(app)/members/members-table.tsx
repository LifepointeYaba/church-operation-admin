"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  type ColumnDef, type SortingState, type VisibilityState, flexRender, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Download, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NativeSelect } from "@/components/native-select"
import { ActivityLabel, EmptyState, FLAG_LABELS, StatusBadge } from "@/components/common"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"
import { bulkUpdateAction, restoreAction } from "./actions"

export type MemberRow = {
  id: number
  name: string
  phone: string | null
  email: string | null
  status: string
  gender: string | null
  teams: string[]
  personResponsible: string | null
  activity: string
  lastDate: string | null
  visits: number
  streak: number
  flags: string[]
}

type Deleted = { id: number; firstName: string; lastName: string; phone: string | null; status: string; deletedAt: string }

const ACTIVITIES = [["active", "Active"], ["at_risk", "At risk"], ["inactive", "Inactive"], ["lapsed", "Lapsed"], ["never", "Never present"]]

export function MembersTable({ rows, initialQuery, initialTab, statuses, teams, deleted }: {
  rows: MemberRow[]; initialQuery: string; initialTab: string; statuses: string[]; teams: string[]; deleted: Deleted[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState(initialTab)
  const [q, setQ] = useState(initialQuery)
  const [f, setF] = useState({ status: "", team: "", gender: "", activity: "", responsible: "" })
  const [sorting, setSorting] = useState<SortingState>([])
  const [visibility, setVisibility] = useState<VisibilityState>({ email: false, visits: false, streak: false })
  const [selection, setSelection] = useState<Record<string, boolean>>({})
  const [pending, start] = useTransition()

  const responsibles = useMemo(() => [...new Set(rows.map((r) => r.personResponsible).filter(Boolean) as string[])].sort(), [rows])

  const data = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const digits = needle.replace(/\D/g, "").replace(/^0/, "")
    return rows.filter((r) => {
      if (tab === "fix" && !r.flags.some((fl) => fl !== "shared_phone")) return false
      if (needle) {
        const inName = r.name.toLowerCase().includes(needle)
        const inPhone = digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits)
        if (!inName && !inPhone) return false
      }
      if (f.status && r.status !== f.status) return false
      if (f.team && !(f.team === "__none" ? r.teams.length === 0 : r.teams.includes(f.team))) return false
      if (f.gender && (f.gender === "__none" ? r.gender : r.gender !== f.gender)) return false
      if (f.activity && r.activity !== f.activity) return false
      if (f.responsible && r.personResponsible !== f.responsible) return false
      return true
    })
  }, [rows, q, f, tab])

  const sortHeader = (label: string) =>
    function Header({ column }: { column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
      return (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          {label} <ArrowUpDown className="size-3 opacity-50" />
        </button>
      )
    }

  const columns = useMemo<ColumnDef<MemberRow>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all on page"
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        />
      ),
      cell: ({ row }) => <Checkbox aria-label={`Select ${row.original.name}`} checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: sortHeader("Name"),
      cell: ({ row }) => (
        <div>
          <Link href={`/members/${row.original.id}`} className="font-medium hover:underline">{row.original.name}</Link>
          {tab === "fix" && (
            <div className="mt-1 flex flex-wrap gap-1">
              {row.original.flags.map((fl) => <Badge key={fl} variant="outline" className="text-[11px]">{FLAG_LABELS[fl] ?? fl}</Badge>)}
            </div>
          )}
        </div>
      ),
      enableHiding: false,
    },
    { accessorKey: "phone", header: "Phone", cell: ({ getValue }) => <span className="tabular-nums whitespace-nowrap">{displayPhone(getValue() as string)}</span> },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "status", header: sortHeader("Status"), cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    { accessorKey: "activity", header: sortHeader("Activity"), cell: ({ getValue }) => <ActivityLabel activity={getValue() as string} /> },
    { id: "teams", accessorFn: (r) => r.teams.join(", "), header: "Teams", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "personResponsible", header: "Responsible" },
    { accessorKey: "gender", header: "Gender" },
    { accessorKey: "lastDate", header: sortHeader("Last attended"), cell: ({ getValue }) => (getValue() ? <span className="whitespace-nowrap">{formatDate(getValue() as string)}</span> : "—"), sortUndefined: "last" },
    { accessorKey: "visits", header: sortHeader("Visits") },
    { accessorKey: "streak", header: sortHeader("Streak") },
  ], [tab])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility: visibility, rowSelection: selection },
    getRowId: (r) => String(r.id),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  })

  const selectedIds = Object.keys(selection).filter((k) => selection[k]).map(Number)
  const bulk = (change: Parameters<typeof bulkUpdateAction>[1]) =>
    start(async () => {
      const res = await bulkUpdateAction(selectedIds, change)
      if (res.ok) {
        toast.success(`Updated ${selectedIds.length} people`)
        setSelection({})
        router.refresh()
      } else toast.error(res.error)
    })

  const exportHref = `/api/export/members?ids=${tab === "fix" || q || Object.values(f).some(Boolean) ? data.map((d) => d.id).join(",") : ""}`

  if (tab === "deleted") {
    return (
      <div className="space-y-4">
        <TabBar tab={tab} setTab={setTab} fixCount={rows.filter((r) => r.flags.some((fl) => fl !== "shared_phone")).length} deletedCount={deleted.length} />
        {deleted.length === 0 ? (
          <EmptyState title="Nothing deleted">Deleted records stay here for 30 days and can be restored.</EmptyState>
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Deleted</TableHead><TableHead>Erased on</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {deleted.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.firstName} {d.lastName}</TableCell>
                    <TableCell>{displayPhone(d.phone)}</TableCell>
                    <TableCell>{formatDate(d.deletedAt, "long")}</TableCell>
                    <TableCell>{formatDate(new Date(new Date(d.deletedAt).getTime() + 30 * 86400000), "long")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
                        const r = await restoreAction(d.id)
                        if (r.ok) { toast.success("Restored"); router.refresh() } else toast.error(r.error)
                      })}><RotateCcw className="size-4" /> Restore</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <TabBar tab={tab} setTab={setTab} fixCount={rows.filter((r) => r.flags.some((fl) => fl !== "shared_phone")).length} deletedCount={deleted.length} />
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => { setQ(e.target.value); table.setPageIndex(0) }} placeholder="Search name or phone…" className="w-full sm:w-64" aria-label="Search" />
        <NativeSelect aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Activity" value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })}>
          <option value="">Any activity</option>
          {ACTIVITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Team" value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })}>
          <option value="">All teams</option>
          <option value="__none">No team</option>
          {teams.map((t) => <option key={t}>{t}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Gender" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
          <option value="">Any gender</option>
          <option>Female</option><option>Male</option><option value="__none">Not set</option>
        </NativeSelect>
        <NativeSelect aria-label="Person responsible" value={f.responsible} onChange={(e) => setF({ ...f, responsible: e.target.value })}>
          <option value="">Any person responsible</option>
          {responsibles.map((r) => <option key={r}>{r}</option>)}
        </NativeSelect>
        <div className="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns3 className="size-4" /> Columns</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} className="capitalize">
                  {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id.replace(/([A-Z])/g, " $1")}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" asChild><a href={exportHref}><Download className="size-4" /> Export CSV</a></Button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2 text-sm">
          <span className="font-medium">{selectedIds.length} selected</span>
          <NativeSelect aria-label="Set status" disabled={pending} defaultValue="" onChange={(e) => e.target.value && bulk({ status: e.target.value })}>
            <option value="">Set status…</option>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Add team" disabled={pending} defaultValue="" onChange={(e) => e.target.value && bulk({ addTeam: e.target.value })}>
            <option value="">Add to team…</option>
            {teams.map((t) => <option key={t}>{t}</option>)}
          </NativeSelect>
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); bulk({ personResponsible: String(new FormData(e.currentTarget).get("pr") ?? "") }) }}>
            <Input name="pr" placeholder="Person responsible" className="h-9 w-44" list="responsibles" />
            <datalist id="responsibles">{responsibles.map((r) => <option key={r} value={r} />)}</datalist>
            <Button size="sm" variant="secondary" disabled={pending}>Set</Button>
          </form>
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>Clear</Button>
        </div>
      )}

      <div className="max-h-[70vh] overflow-auto rounded-xl border bg-card">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>)}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map((c) => <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>)}
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">No people match these filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        {(() => {
          const { pageIndex, pageSize } = table.getState().pagination
          const total = table.getFilteredRowModel().rows.length
          return <span>Results: {total ? pageIndex * pageSize + 1 : 0}–{Math.min(total, (pageIndex + 1) * pageSize)} of {total.toLocaleString()}</span>
        })()}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-3 font-semibold text-foreground tabular-nums">
            {table.getState().pagination.pageIndex + 1}<span className="font-normal text-muted-foreground">&nbsp;/ {Math.max(1, table.getPageCount())}</span>
          </span>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page"><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  )
}

function TabBar({ tab, setTab, fixCount, deletedCount }: { tab: string; setTab: (t: string) => void; fixCount: number; deletedCount: number }) {
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="fix">Fix details <Badge variant="secondary" className="ml-1">{fixCount}</Badge></TabsTrigger>
        <TabsTrigger value="deleted">Deleted <Badge variant="secondary" className="ml-1">{deletedCount}</Badge></TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
