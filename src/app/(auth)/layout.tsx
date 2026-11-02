import { Church } from "lucide-react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <section className="hero-gradient relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="animate-float pointer-events-none absolute -top-24 -left-16 size-96 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="animate-float pointer-events-none absolute -right-20 -bottom-32 size-[28rem] rounded-full bg-fuchsia-300/20 blur-3xl [animation-delay:-6s]" />
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Church className="size-5" aria-hidden />
          </div>
          <span className="text-lg font-semibold">LifePointe</span>
        </div>
        <div className="animate-fade-up relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">Know every face. Follow up every Sunday.</h2>
          <p className="mt-4 text-white/75">Attendance, headcounts, trends and call lists for the LifePointe family, all in one place.</p>
        </div>
        <p className="relative text-sm text-white/60">Church admin dashboard</p>
      </section>
      <section className="flex items-center justify-center bg-background p-4 sm:p-8">
        <div className="animate-fade-up w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-2 text-center lg:items-start lg:text-left">
            <div className="hero-gradient flex size-11 items-center justify-center rounded-xl text-white shadow-lg lg:hidden">
              <Church className="size-6" aria-hidden />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">LifePointe Admin</h1>
            <p className="text-sm text-muted-foreground">Super Admin access only.</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}
