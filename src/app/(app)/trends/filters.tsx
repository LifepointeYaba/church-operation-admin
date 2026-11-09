"use client"

import { useSearchParams } from "next/navigation"
import { useSearchParamNavigation } from "@/components/navigation"
import { Input } from "@/components/ui/input"
import { SelectField } from "@/components/select-field"

export function TrendFilters({ statuses, teams, range, from, to }: { statuses: string[]; teams: string[]; range: string; from: string; to: string }) {
  const params = useSearchParams()
  const { setParams: set } = useSearchParamNavigation()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SelectField aria-label="Date range" value={range} onChange={(e) => set({ range: e.target.value })}>
        <option value="sunday">Last Sunday</option>
        <option value="month">Last month</option>
        <option value="quarter">Last quarter</option>
        <option value="6m">Last 6 months</option>
        <option value="12m">Last 12 months</option>
        <option value="2025">Since Jan 2025</option>
        <option value="all">Full history</option>
        <option value="custom">Custom…</option>
      </SelectField>
      {range === "custom" && (
        <>
          <Input type="date" aria-label="From" className="h-9 w-40" defaultValue={from} onChange={(e) => set({ from: e.target.value })} />
          <Input type="date" aria-label="To" className="h-9 w-40" defaultValue={to} onChange={(e) => set({ to: e.target.value })} />
        </>
      )}
      <SelectField aria-label="Status" value={params.get("status") ?? ""} onChange={(e) => set({ status: e.target.value })}>
        <option value="">All statuses</option>
        {statuses.map((s) => <option key={s}>{s}</option>)}
      </SelectField>
      <SelectField aria-label="Team" value={params.get("team") ?? ""} onChange={(e) => set({ team: e.target.value })}>
        <option value="">All teams</option>
        {teams.map((t) => <option key={t}>{t}</option>)}
      </SelectField>
      <SelectField aria-label="Gender" value={params.get("gender") ?? ""} onChange={(e) => set({ gender: e.target.value })}>
        <option value="">Any gender</option>
        <option>Female</option><option>Male</option>
      </SelectField>
    </div>
  )
}
