export function AuthHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center lg:text-left">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
