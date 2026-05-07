import { ApiKeyGate } from '@/features/chat/api-key-gate'
import { ChatScreen } from '@/features/chat/chat-screen'

export default function Home() {
  return (
    <ApiKeyGate>
      <ChatScreen />
    </ApiKeyGate>
  )
}
