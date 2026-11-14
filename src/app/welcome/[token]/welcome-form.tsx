"use client"

import { useState, useTransition } from "react"
import { Heart, Loader2 } from "lucide-react"
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

const field = "w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none transition focus:border-[#c2410c] focus:ring-2 focus:ring-[#c2410c]/20"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-bold tracking-[0.06em] uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[15px] font-medium">{label}{required && <span className="text-red-600"> *</span>}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
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
      <div className="animate-fade-up flex min-h-[80svh] flex-col items-center justify-center gap-6 text-center">
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
    <form onSubmit={submit} className="space-y-5" noValidate>
      <header className="space-y-3 pt-4 pb-2 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#c2410c] text-white shadow-lg shadow-orange-500/20">
          <Heart className="size-8 fill-current" />
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight">Welcome Home</h1>
        <p className="text-muted-foreground">We’re so glad you joined us today. Fill this out so we can stay connected and help you take your next step.</p>
        <p className="text-xs font-semibold tracking-wide text-[#c2410c] uppercase">Sunday {sunday}</p>
      </header>

      <Section title="Your details">
        <Field label="Full Name" required>
          <input className={field} autoComplete="name" placeholder="Jane Doe" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </Field>
        <Field label="Phone Number" required>
          <input className={field} type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" className="size-4 accent-[#c2410c]" checked={f.onWhatsapp} onChange={(e) => set("onWhatsapp", e.target.checked)} />
          This number is on WhatsApp
        </label>
        <Field label="Email">
          <input className={field} type="email" inputMode="email" autoComplete="email" placeholder="jane@email.com" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Gender">
          <select className={field} value={f.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Select an option</option>
            <option>Female</option>
            <option>Male</option>
          </select>
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
      </Section>

      <Section title="About your visit">
        <Field label="How did you hear about us?">
          <select className={field} value={f.howHeard} onChange={(e) => set("howHeard", e.target.value)}>
            <option value="">Select an option</option>
            {HOW_HEARD.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Are you looking for a church home?">
          <select className={field} value={f.churchHome} onChange={(e) => set("churchHome", e.target.value)}>
            <option value="">Select an option</option>
            {CHURCH_HOME.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="I'm interested in">
        <Chips label="I'm interested in" options={INTERESTS} value={f.interests} onChange={(v) => set("interests", v)} />
      </Section>

      <Section title="I'd like to grow in">
        <Chips label="I'd like to grow in" options={GROWTH} value={f.growth} onChange={(v) => set("growth", v)} />
      </Section>

      <Section title="Anything else?">
        <Field label="Prayer Request">
          <textarea className={field} rows={3} placeholder="How can we pray for you?" value={f.prayerRequest} onChange={(e) => set("prayerRequest", e.target.value)} />
        </Field>
        <Field label="Comments">
          <textarea className={field} rows={3} placeholder="Share your thoughts about your visit..." value={f.comments} onChange={(e) => set("comments", e.target.value)} />
        </Field>
        <Field label="How can we improve?">
          <textarea className={field} rows={3} placeholder="Any feedback for us?" value={f.improve} onChange={(e) => set("improve", e.target.value)} />
        </Field>
      </Section>

      {/* Honeypot for bots: hidden from people and screen readers. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => set("website", e.target.value)} />

      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

      <button type="submit" disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c2410c] px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#a5370a] disabled:opacity-70">
        {pending && <Loader2 className="size-5 animate-spin" />} Submit
      </button>
      <p className="pb-6 text-center text-sm text-muted-foreground">Your information is kept private and used only to follow up with you.</p>
    </form>
  )
}
