export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#c2410c] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lifepointe-horizontal-white.png" alt="LifePointe" className="relative w-48" />
        <div className="animate-fade-up relative max-w-md">
          <p className="text-[13px] font-bold tracking-[0.06em] uppercase">Church admin</p>
          <h2 className="mt-3 font-display text-[40px] leading-[46px] font-bold tracking-[-0.015em]">Know every face. Follow up every Sunday.</h2>
          <p className="mt-4 text-lg leading-7">Attendance, headcounts, trends and call lists for the LifePointe family, all in one place.</p>
        </div>
        <p className="relative text-sm">An expression of Elevation Church</p>
      </section>
      <section className="flex items-center justify-center bg-background p-4 sm:p-8">
        <div className="animate-fade-up w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lifepointe-horizontal-color.png" alt="LifePointe" className="w-40 lg:hidden dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lifepointe-horizontal-white.png" alt="LifePointe" className="hidden w-40 dark:block lg:dark:hidden" />
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Super Admin access only.</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}
