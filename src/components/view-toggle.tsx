"use client"

import { useEffect, useState } from "react"
import { Segmented } from "./charts"

type View = "table" | "chart"

/** Table / Chart switch for a card. The choice is remembered per card on this device. */
export function ViewToggle({ id, toolbar, table, chart }: { id: string; toolbar?: React.ReactNode; table: React.ReactNode; chart: React.ReactNode }) {
  const key = `view:${id}`
  const [view, setView] = useState<View>("table")
  useEffect(() => {
    const saved = localStorage.getItem(key)
    if (saved === "chart" || saved === "table") setView(saved)
  }, [key])
  const change = (v: View) => {
    setView(v)
    localStorage.setItem(key, v)
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {toolbar}
        <div className="ml-auto">
          <Segmented label="View as" value={view} onChange={change} options={[["table", "Table"], ["chart", "Chart"]]} />
        </div>
      </div>
      {view === "table" ? table : chart}
    </div>
  )
}
