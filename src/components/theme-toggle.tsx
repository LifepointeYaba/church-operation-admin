"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { saveThemePref } from "@/app/(app)/actions"

/** Theme picker. The choice is kept in the browser (no flash on load) and saved to the account. */
export function ThemeToggle({ accountPref }: { accountPref: string }) {
  const { theme, setTheme } = useTheme()

  // On a new browser, adopt the theme saved on the account.
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("theme") && accountPref !== "system") setTheme(accountPref)
  }, [accountPref, setTheme])

  const choose = (t: string) => {
    setTheme(t)
    void saveThemePref(t)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Theme">
          <Sun className="size-4 scale-100 dark:scale-0" />
          <Moon className="absolute size-4 scale-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={choose}>
          <DropdownMenuRadioItem value="light"><Sun className="size-4" /> Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon className="size-4" /> Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor className="size-4" /> System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
