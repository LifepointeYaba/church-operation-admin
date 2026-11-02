import { Resend } from "resend"

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)

export async function sendEmail(to: string, subject: string, html: string) {
  if (!emailConfigured()) return false
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({ from: process.env.EMAIL_FROM!, to, subject, html })
  if (error) throw new Error(error.message)
  return true
}
