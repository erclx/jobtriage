import { cn } from '@/lib/utils'

interface BrandMarkProps {
  readonly className?: string
  readonly title?: string
}

export function BrandMark({ className, title }: BrandMarkProps) {
  const isLabelled = Boolean(title)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={cn('size-7 shrink-0', className)}
      role={isLabelled ? 'img' : undefined}
      aria-label={title}
      aria-hidden={isLabelled ? undefined : true}
    >
      <rect width="32" height="32" rx="6" className="fill-foreground" />
      <circle cx="19" cy="9" r="2.5" className="fill-background" />
      <path
        d="M19 14 V21 a5 5 0 0 1 -5 5 H10"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-background"
      />
    </svg>
  )
}
