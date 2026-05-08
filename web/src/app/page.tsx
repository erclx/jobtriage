'use client'

import { useState } from 'react'

import { ApiKeyGate } from '@/features/chat/api-key-gate'
import { ChatScreen } from '@/features/chat/chat-screen'

export default function Home() {
  const [switchRequested, setSwitchRequested] = useState(false)

  return (
    <ApiKeyGate
      switchRequested={switchRequested}
      onResolveSwitch={() => setSwitchRequested(false)}
    >
      <ChatScreen onSwitchProvider={() => setSwitchRequested(true)} />
    </ApiKeyGate>
  )
}
