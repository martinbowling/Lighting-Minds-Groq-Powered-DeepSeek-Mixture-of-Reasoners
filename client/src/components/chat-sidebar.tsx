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
import { PlusCircle } from 'lucide-react';

interface ChatSidebarProps {
  onNewChat: () => void;
  onLoadChat?: (messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>) => void;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  className?: string;
}

export function ChatSidebar({ onNewChat, onLoadChat, messages, className }: ChatSidebarProps) {
  const [open, setOpen] = useState(false);

  // Group messages by conversation based on timestamps
  const conversations = messages.reduce((acc, message) => {
    const date = new Date(message.timestamp);
    const key = date.toLocaleDateString();

    if (!acc[key]) {
      acc[key] = [];
    }
    if (message.role === 'user') {
      acc[key].push(message);
    }
    return acc;
  }, {} as Record<string, typeof messages>);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="fixed left-4 top-4 z-10">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className={cn("w-[300px] p-0 bg-background", className)}>
        <div className="flex flex-col h-full border-r">
          <div className="p-4 border-b bg-background">
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
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {Object.entries(conversations).reverse().map(([date, messages]) => (
                <div key={date} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {date}
                  </h3>
                  {messages.map((message) => (
                    <div 
                      key={message.timestamp}
                      className="text-sm truncate text-muted-foreground hover:text-foreground cursor-pointer p-2 rounded-md hover:bg-accent"
                      onClick={() => {
                        // Find all messages from this conversation
                        const conversation = messages.filter(msg => {
                          const msgDate = new Date(msg.timestamp).toLocaleDateString();
                          return msgDate === date;
                        });
                        onLoadChat?.(conversation);
                        setOpen(false);
                      }}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}