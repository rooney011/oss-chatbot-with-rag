'use client';

import { Plus, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarGroupAction,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronUp, User2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  messageCount: number;
}

export function ChatHistorySidebar() {
  const router = useRouter();
  const params = useParams();
  const currentSessionId = params.sessionId?.[0];

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
    fetchUser();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUser = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || 'User');
    }
  };

  const handleNewChat = () => {
    router.push('/chat');
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!conversationToDelete) return;

    try {
      const response = await fetch(`/api/conversations?id=${conversationToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from local state
        setConversations(prev => prev.filter(c => c.id !== conversationToDelete));

        // If we deleted the current conversation, navigate to new chat
        if (currentSessionId === conversationToDelete) {
          router.push('/chat');
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    } finally {
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const conversationToDeleteTitle = conversations.find(c => c.id === conversationToDelete)?.title;

  return (
    <>
      <Sidebar collapsible='offcanvas'>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-lg font-bold">Chatbot</SidebarGroupLabel>
            <SidebarGroupAction title="New Chat" onClick={handleNewChat}>
              <Plus /> <span className="sr-only">New Chat</span>
            </SidebarGroupAction>

            <SidebarGroupContent>
              <SidebarMenu>
                {isLoading ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground">Loading...</div>
                ) : conversations.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground">No conversations yet</div>
                ) : (
                  conversations.map((conversation) => (
                    <SidebarMenuItem key={conversation.id} className="group">
                      <div className="flex items-center w-full gap-2">
                        <SidebarMenuButton
                          asChild
                          isActive={currentSessionId === conversation.id}
                        >
                          <a href={`/chat/${conversation.id}`} className="flex-1">
                            <span className="truncate">{conversation.title}</span>
                          </a>
                        </SidebarMenuButton>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDeleteClick(e, conversation.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${conversation.title}`}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <User2 /> {userEmail}
                    <ChevronUp className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                  <DropdownMenuItem onClick={handleSignOut}>
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <span className="font-semibold">{conversationToDeleteTitle || 'this conversation'}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

