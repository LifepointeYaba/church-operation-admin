import type { NextAuthConfig } from "next-auth"

/** Edge-safe part of the auth config (used by middleware). */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60, updateAge: 5 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id
        token.role = (user as { role?: string }).role
        token.loginAt = Date.now()
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string
        ;(session.user as { role?: string }).role = token.role as string
        ;(session as { loginAt?: number }).loginAt = token.loginAt as number
      }
      return session
    },
  },
} satisfies NextAuthConfig
