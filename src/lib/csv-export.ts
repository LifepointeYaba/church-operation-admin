/** Build CSV text from rows (RFC 4180 quoting). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const q = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.map(q).join(","), ...rows.map((r) => r.map(q).join(","))].join("\n")
}
