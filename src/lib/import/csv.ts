import Papa from "papaparse"
import * as XLSX from "xlsx"

/** Parse CSV or Excel bytes into a grid of trimmed-right strings. */
export function readGrid(data: Buffer | string, fileName = "file.csv"): string[][] {
  const lower = fileName.toLowerCase()
  if (typeof data !== "string" && (lower.endsWith(".xlsx") || lower.endsWith(".xls"))) {
    const wb = XLSX.read(data, { type: "buffer", cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, dateNF: "d-mmm-yyyy", defval: "" })
    return rows.map((r) => r.map((c) => String(c ?? "")))
  }
  const text = typeof data === "string" ? data : data.toString("utf8")
  const res = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false })
  return res.data.map((r) => r.map((c) => String(c ?? "")))
}
