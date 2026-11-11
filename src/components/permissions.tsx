"use client"

import { createContext, useCallback, useContext } from "react"
import type { Permission } from "@/lib/permissions"

const PermissionsContext = createContext<readonly Permission[]>([])

/** Hands the signed-in user's permissions to client components (the server still checks every action). */
export function PermissionsProvider({ permissions, children }: { permissions: readonly Permission[]; children: React.ReactNode }) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>
}

/** `const can = useCan(); can("members.edit") && <EditButton />` */
export function useCan() {
  const perms = useContext(PermissionsContext)
  return useCallback((p: Permission) => perms.includes(p), [perms])
}
