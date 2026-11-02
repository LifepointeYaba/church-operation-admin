import { revalidatePath, revalidateTag } from "next/cache"
import { METRICS_TAG } from "./metrics"

export function refreshData() {
  revalidateTag(METRICS_TAG)
  revalidatePath("/", "layout")
}
