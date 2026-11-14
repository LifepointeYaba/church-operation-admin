"use client"

import { useState, useTransition } from "react"
import { ChevronDown, Heart, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { BIBLE_VERSES, CHURCH_HOME, GROWTH, HOW_HEARD, INTERESTS } from "@/lib/first-timers-shared"
import { submitFirstTimerAction } from "../actions"

type Form = {
  fullName: string; phone: string; email: string; gender: string; birthday: string; address: string
  howHeard: string; churchHome: string; interests: string[]; growth: string[]
  prayerRequest: string; comments: string; improve: string; onWhatsapp: boolean; website: string
}
const EMPTY: Form = {
  fullName: "", phone: "", email: "", gender: "", birthday: "", address: "", howHeard: "", churchHome: "",
  interests: [], growth: [], prayerRequest: "", comments: "", improve: "", onWhatsapp: true, website: "",
}

// text-base (16px) stops iPhones zooming in when a field is tapped.
const field = "w-full min-w-0 rounded-xl border border-input bg-background px-4 py-3 text-base outline-none transition focus:border-[#c2410c] focus:ring-2 focus:ring-[#c2410c]/20"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-sm font-bold tracking-[0.06em] uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, required, children, hint, wide }: { label: string; required?: boolean; children: React.ReactNode; hint?: string; wide?: boolean }) {
  return (
    <label className={cn("block min-w-0 space-y-1.5", wide && "md:col-span-2")}>
      <span className="text-[15px] font-medium">{label}{required && <span className="text-red-600"> *</span>}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

/** Native select with the browser arrow hidden and our own chevron inset from the border. */
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select className={cn(field, "cursor-pointer appearance-none pr-12")} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select an option</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

/** One column on phones, two from tablet width up. */
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>
}

function Chips({ options, value, onChange, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button key={o} type="button" aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            className={cn("rounded-full border px-4 py-2 text-[15px] transition",
              on ? "border-[#c2410c] bg-[#c2410c] text-white" : "bg-background hover:border-[#c2410c]/60")}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

export function WelcomeForm({ token, sunday }: { token: string; sunday: string }) {
  const [f, setF] = useState<Form>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ firstName: string; verse: (typeof BIBLE_VERSES)[number] } | null>(null)
  const [pending, start] = useTransition()
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (f.fullName.trim().length < 2) return setError("Please enter your full name.")
    if (f.phone.replace(/\D/g, "").length < 10) return setError("Please enter your phone number.")
    start(async () => {
      try {
        const r = await submitFirstTimerAction(token, f)
        if (!r.ok) return setError(r.error)
        setDone({ firstName: r.firstName, verse: BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)] })
        window.scrollTo({ top: 0, behavior: "smooth" })
      } catch {
        setError("We couldn’t send your details. Check your connection and try again.")
      }
    })
  }

  if (done) {
    return (
      <div className="animate-fade-up mx-auto flex min-h-[80svh] max-w-lg flex-col items-center justify-center gap-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lifepointe-horizontal-color.png" alt="LifePointe" className="w-56 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lifepointe-horizontal-white.png" alt="LifePointe" className="hidden w-56 dark:block" />
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold">Thank you, {done.firstName}!</h1>
          <p className="text-muted-foreground">We’re so glad you joined us today. Someone from our team will reach out soon.</p>
        </div>
        <figure className="w-full rounded-2xl border bg-card p-6 shadow-sm">
          <blockquote className="font-display text-xl leading-relaxed">“{done.verse.text}”</blockquote>
          <figcaption className="mt-3 text-sm font-semibold text-[#c2410c]">{done.verse.ref}</figcaption>
        </figure>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-xl gap-6 md:max-w-3xl lg:max-w-none lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      {/* Phones/tablets: heading on top. Laptops: heading stays put on the left while the form scrolls. */}
      <header className="space-y-3 pt-2 text-center lg:sticky lg:top-10 lg:self-start lg:pt-8 lg:text-left">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#c2410c] text-white shadow-lg shadow-orange-500/20 sm:size-16 lg:mx-0">
          <Heart className="size-7 fill-current sm:size-8" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Welcome Home</h1>
        <p className="text-muted-foreground sm:text-lg">We’re so glad you joined us today. Fill this out so we can stay connected and help you take your next step.</p>
        <p className="text-xs font-semibold tracking-wide text-[#c2410c] uppercase sm:text-sm">Sunday {sunday}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lifepointe-horizontal-color.png" alt="LifePointe" className="hidden w-40 pt-6 lg:block dark:lg:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lifepointe-horizontal-white.png" alt="LifePointe" className="hidden w-40 pt-6 dark:lg:block" />
      </header>

    <form onSubmit={submit} className="min-w-0 space-y-5" noValidate>

      <Section title="Your details">
        <Grid>
        <Field label="Full Name" required>
          <input className={field} autoComplete="name" placeholder="Jane Doe" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </Field>
        <Field label="Phone Number" required>
          <input className={field} type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-[15px] md:col-span-2 md:-mt-1">
          <input type="checkbox" className="size-4 accent-[#c2410c]" checked={f.onWhatsapp} onChange={(e) => set("onWhatsapp", e.target.checked)} />
          This number is on WhatsApp
        </label>
        <Field label="Email">
          <input className={field} type="email" inputMode="email" autoComplete="email" placeholder="jane@email.com" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Gender">
          <Select value={f.gender} onChange={(v) => set("gender", v)} options={["Female", "Male"]} />
        </Field>
        <Field label="Birthday (Month & Day)" hint="e.g. 08-15 for 15 August">
          <input className={field} inputMode="numeric" placeholder="08-15" maxLength={5} value={f.birthday}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4)
              set("birthday", d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d)
            }} />
        </Field>
        <Field label="Address">
          <input className={field} autoComplete="street-address" placeholder="Yaba, Lagos" value={f.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        </Grid>
      </Section>

      <Section title="About your visit">
        <Grid>
        <Field label="How did you hear about us?">
          <Select value={f.howHeard} onChange={(v) => set("howHeard", v)} options={HOW_HEARD} />
        </Field>
        <Field label="Are you looking for a church home?">
          <Select value={f.churchHome} onChange={(v) => set("churchHome", v)} options={CHURCH_HOME} />
        </Field>
        </Grid>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="I'm interested in">
          <Chips label="I'm interested in" options={INTERESTS} value={f.interests} onChange={(v) => set("interests", v)} />
        </Section>
        <Section title="I'd like to grow in">
          <Chips label="I'd like to grow in" options={GROWTH} value={f.growth} onChange={(v) => set("growth", v)} />
        </Section>
      </div>

      <Section title="Anything else?">
        <Grid>
        <Field label="Prayer Request" wide>
          <textarea className={field} rows={3} placeholder="How can we pray for you?" value={f.prayerRequest} onChange={(e) => set("prayerRequest", e.target.value)} />
        </Field>
        <Field label="Comments">
          <textarea className={field} rows={3} placeholder="Share your thoughts about your visit..." value={f.comments} onChange={(e) => set("comments", e.target.value)} />
        </Field>
        <Field label="How can we improve?">
          <textarea className={field} rows={3} placeholder="Any feedback for us?" value={f.improve} onChange={(e) => set("improve", e.target.value)} />
        </Field>
        </Grid>
      </Section>

      {/* Honeypot for bots: hidden from people and screen readers. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => set("website", e.target.value)} />

      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

      <button type="submit" disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c2410c] px-6 py-4 active:scale-[0.99] text-lg font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#a5370a] disabled:opacity-70">
        {pending && <Loader2 className="size-5 animate-spin" />} Submit
      </button>
      <p className="pb-6 text-center text-sm text-muted-foreground">Your information is kept private and used only to follow up with you.</p>
    </form>
    </div>
  )
}
