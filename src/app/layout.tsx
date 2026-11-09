import type { Metadata, Viewport } from "next"
import { Geist_Mono, Nunito, Quicksand } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["400", "600", "700"] })
const quicksand = Quicksand({ variable: "--font-quicksand", subsets: ["latin"], weight: ["500", "600", "700"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "LifePointe Admin", template: "%s · LifePointe Admin" },
  description: "Church attendance and membership dashboard",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafbf6" },
    { media: "(prefers-color-scheme: dark)", color: "#12150f" },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${nunito.variable} ${quicksand.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
