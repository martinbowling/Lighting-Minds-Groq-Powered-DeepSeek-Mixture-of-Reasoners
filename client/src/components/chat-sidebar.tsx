import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { PlusCircle, MessageSquare } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  onNewChat: () => void;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  className?: string;
}

export function ChatSidebar({ onNewChat, messages, className }: ChatSidebarProps) {
  const [open, setOpen] = useState(true);

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
          <MessageSquare className="h-4 w-4" />
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