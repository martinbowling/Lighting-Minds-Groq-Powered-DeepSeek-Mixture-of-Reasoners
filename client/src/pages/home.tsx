import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ChatInterface } from '@/components/chat-interface';
import { ChatSidebar } from '@/components/chat-sidebar';
import { SettingsPanel } from '@/components/settings-panel';
import { useState, useEffect } from 'react';
import { db, type ChatMessage } from '@/lib/db';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    db.getMessages().then(setMessages);
  }, []);

  const handleNewChat = async () => {
    await db.clearMessages();
    setMessages([]);
  };

  return (
    <div className="h-screen">
      <ChatSidebar
        messages={messages}
        onNewChat={handleNewChat}
        className="hidden md:block"
      />

      <main className="h-full md:pl-[300px]">
        <div className="container mx-auto p-4 h-full flex flex-col">
          <header className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold">🧠 Mind Mosaic</h1>
              <p className="text-muted-foreground">
                Dynamic Multi-Perspective Analysis Engine
              </p>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <SettingsPanel />
              </DialogContent>
            </Dialog>
          </header>

          <Card className="flex-1">
            <ChatInterface />
          </Card>
        </div>
      </main>
    </div>
  );
}