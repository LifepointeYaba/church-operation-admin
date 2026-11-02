import { put } from "@vercel/blob"

export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN

/** Store an uploaded file in Vercel Blob (random suffix so URLs can't be guessed). Returns null when Blob isn't set up. */
export async function storeFile(folder: string, name: string, data: Buffer | string, contentType?: string) {
  if (!blobConfigured()) return null
  const safe = name.replace(/[^\w.\-]+/g, "_")
  const res = await put(`${folder}/${safe}`, data, { access: "public", addRandomSuffix: true, contentType })
  return res.url
}
