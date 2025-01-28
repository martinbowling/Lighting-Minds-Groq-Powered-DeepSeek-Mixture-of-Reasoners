import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatInterface } from '@/components/chat-interface';
import { ChatSidebar } from '@/components/chat-sidebar';
import { SettingsPanel } from '@/components/settings-panel';
import { useState, useEffect } from 'react';
import { db, type ChatMessage } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>();
  const { toast } = useToast();

  useEffect(() => {
    // Load all messages initially
    db.getMessages().then((msgs) => {
      setAllMessages(msgs);
      if (msgs.length > 0) {
        // Get the most recent chat
        const latestChatId = msgs[msgs.length - 1].chatId;
        setCurrentChatId(latestChatId);
        // Filter messages for the latest chat
        setMessages(msgs.filter(m => m.chatId === latestChatId));
      }
    });
  }, []);

  const handleNewChat = async () => {
    setMessages([]);
    setCurrentChatId(undefined);
  };

  const handleClearChats = async () => {
    try {
      await db.clearMessages();
      setMessages([]);
      setAllMessages([]);
      setCurrentChatId(undefined);
      toast({
        title: "Success",
        description: "All chats have been cleared"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear chats",
        variant: "destructive"
      });
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await db.deleteChat(chatId);
      // Update allMessages by removing deleted chat messages
      setAllMessages(prev => prev.filter(m => m.chatId !== chatId));
      // Clear current chat if it was deleted
      if (currentChatId === chatId) {
        setMessages([]);
        setCurrentChatId(undefined);
      }
      toast({
        title: "Success",
        description: "Chat has been deleted"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete chat",
        variant: "destructive"
      });
    }
  };

  const handleLoadChat = async (chatId: string) => {
    try {
      // Load messages for selected chat
      const chatMessages = await db.getMessagesByChat(chatId);
      if (chatMessages.length > 0) {
        setMessages(chatMessages);
        setCurrentChatId(chatId);
      } else {
        toast({
          title: "Error",
          description: "No messages found for this chat",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      toast({
        title: "Error",
        description: "Failed to load chat",
        variant: "destructive"
      });
    }
  };

  const handleChatCreated = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  return (
    <div className="h-screen bg-background">
      <ChatSidebar
        messages={allMessages}
        onNewChat={handleNewChat}
        onClearChats={handleClearChats}
        onDeleteChat={handleDeleteChat}
        onLoadChat={handleLoadChat}
        className="hidden md:block"
      />

      <main className="h-full md:pl-[300px]">
        <div className="h-full flex flex-col">
          <header className="flex justify-between items-center p-4">
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
                <DialogTitle>Settings</DialogTitle>
                <SettingsPanel />
              </DialogContent>
            </Dialog>
          </header>

          <Card className="flex-1 bg-background border overflow-hidden">
            <ChatInterface 
              messages={messages}
              chatId={currentChatId}
              onChatCreated={handleChatCreated}
              setMessages={(newMessages) => {
                setMessages(newMessages);
                // Update allMessages when newMessages is an array
                if (Array.isArray(newMessages)) {
                  setAllMessages(prev => [
                    ...prev.filter(m => m.chatId !== currentChatId), 
                    ...newMessages
                  ]);
                }
              }}
            />
          </Card>
        </div>
      </main>
    </div>
  );
}