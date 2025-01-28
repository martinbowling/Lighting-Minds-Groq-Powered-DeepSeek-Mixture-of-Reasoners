import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { PlusCircle, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ChatMessage {
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSidebarProps {
  onNewChat: () => void;
  onClearChats: () => void;
  onDeleteChat?: (chatId: string) => void;
  onLoadChat?: (chatId: string) => void;
  messages: Array<ChatMessage>;
  className?: string;
}

export function ChatSidebar({ 
  onNewChat, 
  onClearChats, 
  onDeleteChat,
  onLoadChat, 
  messages, 
  className 
}: ChatSidebarProps) {
  const [open, setOpen] = useState(false);

  // Group messages by chat ID and get the first user message as the title
  const chats = messages.reduce((acc, message) => {
    if (!message.chatId) return acc;

    if (!acc[message.chatId]) {
      acc[message.chatId] = {
        title: message.role === 'user' ? message.content : 'New Chat',
        messages: [],
        timestamp: message.timestamp
      };
    }
    acc[message.chatId].messages.push(message);
    return acc;
  }, {} as Record<string, { title: string, messages: typeof messages, timestamp: number }>);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="fixed left-4 top-4 z-10">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className={cn("w-[300px] p-0 bg-background", className)}>
        <div className="flex flex-col h-full border-r">
          <div className="p-4 border-b bg-background space-y-2">
            <Button 
              onClick={() => {
                onNewChat();
                setOpen(false);
              }} 
              className="w-full"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              New Chat
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Chats
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your
                    chat history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      onClearChats();
                      setOpen(false);
                    }}
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {Object.entries(chats)
                .sort(([,a], [,b]) => b.timestamp - a.timestamp)
                .map(([chatId, chat]) => (
                <div key={chatId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {new Date(chat.timestamp).toLocaleDateString()}
                    </h3>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this chat
                            and all its messages.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                              onDeleteChat?.(chatId);
                              setOpen(false);
                            }}
                          >
                            Delete Chat
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div 
                    className="text-sm truncate text-muted-foreground hover:text-foreground cursor-pointer p-2 rounded-md hover:bg-accent"
                    onClick={() => {
                      onLoadChat?.(chatId);
                      setOpen(false);
                    }}
                  >
                    {chat.title}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}