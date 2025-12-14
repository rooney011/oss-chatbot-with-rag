"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { ChatHistorySidebar } from "@/components/chat/ChatHistorySidebar"

export default function ChatSidebar() {
  return (

    <SidebarProvider>
      <ChatHistorySidebar />
      <SidebarTrigger />
    </SidebarProvider>
  )
}