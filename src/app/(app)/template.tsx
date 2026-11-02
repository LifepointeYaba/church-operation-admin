/** Re-mounts on every navigation, so each page fades in. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>
}
