'use client'

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'

const NEXT_THEME = {
  system: 'light',
  light: 'dark',
  dark: 'system',
} as const

type ThemeMode = keyof typeof NEXT_THEME

function isThemeMode(value: string | undefined): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mode: ThemeMode = isThemeMode(theme) ? theme : 'system'
  const Icon =
    mode === 'system' ? MonitorIcon : mode === 'light' ? SunIcon : MoonIcon

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Theme: ${mode}. Switch to ${NEXT_THEME[mode]}.`}
      onClick={() => setTheme(NEXT_THEME[mode])}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  )
}
