'use client';

import { ChatExperience } from '@/components/chat/ChatExperience';

/**
 * Chat interno a pantalla completa. Toda la lógica/visual vive en
 * `ChatExperience` (compartida con el dock flotante `ChatDock`), aquí solo se
 * monta en su variante de página.
 */
export default function ChatPage() {
  return <ChatExperience variant="page" />;
}
