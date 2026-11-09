"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NavigationProvider } from "./navigation"
import { ConfirmProvider } from "./confirm-dialog"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
      mutations: { retry: 0 },
    },
  }))
  return (
    <QueryClientProvider client={client}>
      <NavigationProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </NavigationProvider>
    </QueryClientProvider>
  )
}
