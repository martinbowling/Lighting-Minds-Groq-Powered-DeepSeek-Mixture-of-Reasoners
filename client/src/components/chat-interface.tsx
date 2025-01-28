import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Download, Upload, Copy, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ChatMessage, Reasoner } from '@/lib/db';
import { db } from '@/lib/db';
import { GroqClient } from '@/lib/groq';
import { ReasonerView } from '@/components/reasoner-view';
import ReactMarkdown from 'react-markdown';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StreamingMessage extends ChatMessage {
  isComplete?: boolean;
}

interface ChatInterfaceProps {
  messages: StreamingMessage[];
  setMessages: React.Dispatch<React.SetStateAction<StreamingMessage[]>>;
  chatId?: string;
  onChatCreated?: (chatId: string) => void;
}

export function ChatInterface({ messages, setMessages, chatId, onChatCreated }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const currentChatId = useRef(chatId || crypto.randomUUID());

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const settings = await db.getSettings();
    if (!settings.apiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your Groq API key in settings",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const groq = new GroqClient({
        apiKey: settings.apiKey,
      });

      // If this is a new chat, notify parent
      if (!chatId) {
        onChatCreated?.(currentChatId.current);
      }

      // Add user message and save it immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content: input,
        timestamp: Date.now(),
        chatId: currentChatId.current
      };

      // Save user message first
      await db.addMessage(userMessage);
      setMessages(prev => [...prev, userMessage]);
      setInput('');

      // Add initial status message
      const statusMessage: StreamingMessage = {
        role: 'assistant',
        content: '🔍 Analyzing your question...',
        timestamp: Date.now(),
        chatId: currentChatId.current
      };
      await db.addMessage(statusMessage);
      setMessages(prev => [...prev, statusMessage]);

      // Get reasoners with streaming updates
      const reasonerList = await groq.getReasoners(input, (content) => {
        setMessages(prev => [
          ...prev.slice(0, -1),
          {
            ...statusMessage,
            content: '🔍 Choosing perspectives...\n\n' + content
          }
        ]);
      });

      // Update status to show chosen perspectives
      const perspectivesMessage: StreamingMessage = {
        role: 'assistant',
        content: '✨ Perspectives chosen:\n\n' + reasonerList.map(
          r => `${r.emoji} ${r.name}`
        ).join('\n'),
        timestamp: Date.now(),
        chatId: currentChatId.current
      };
      await db.addMessage(perspectivesMessage);
      setMessages(prev => [...prev.slice(0, -1), perspectivesMessage]);

      // Process each perspective
      const analyses: Array<{ reasoner: Reasoner; analysis: string }> = [];

      for (const reasoner of reasonerList) {
        // Add new message for this reasoner
        const analysisMessage: StreamingMessage = {
          role: 'assistant',
          content: `### ${reasoner.emoji} ${reasoner.name}'s Analysis\n\nAnalyzing...`,
          timestamp: Date.now(),
          isComplete: false,
          chatId: currentChatId.current
        };

        // Save initial analysis message
        await db.addMessage(analysisMessage);
        setMessages(prev => [...prev, analysisMessage]);

        // Stream in the analysis
        const analysis = await groq.getReasonerAnalysis(input, reasoner, (content) => {
          setMessages(prev => {
            const index = prev.findIndex(m =>
              m.timestamp === analysisMessage.timestamp
            );
            if (index === -1) return prev;

            const newMessages = [...prev];
            newMessages[index] = {
              ...analysisMessage,
              content: `### ${reasoner.emoji} ${reasoner.name}'s Analysis\n\n${content}`
            };
            return newMessages;
          });
        });

        // Update the analysis message with final content
        const finalAnalysisMessage = {
          ...analysisMessage,
          content: `### ${reasoner.emoji} ${reasoner.name}'s Analysis\n\n${analysis}`,
          isComplete: true,
          chatId: currentChatId.current
        };
        await db.addMessage(finalAnalysisMessage);

        setMessages(prev => {
          const index = prev.findIndex(m => m.timestamp === analysisMessage.timestamp);
          if (index === -1) return prev;
          const newMessages = [...prev];
          newMessages[index] = finalAnalysisMessage;
          return newMessages;
        });

        analyses.push({ reasoner, analysis });
      }

      // Add synthesis message
      const synthesisMessage: StreamingMessage = {
        role: 'assistant',
        content: '# 🌟 Integrated Synthesis\n\nSynthesizing perspectives...',
        timestamp: Date.now(),
        reasoning_content: analyses.map(a =>
          `### ${a.reasoner.emoji} ${a.reasoner.name}\n\n${a.analysis}`
        ).join('\n\n'),
        chatId: currentChatId.current
      };

      // Save initial synthesis message
      await db.addMessage(synthesisMessage);
      setMessages(prev => [...prev, synthesisMessage]);

      // Stream in the synthesis
      let finalContent = '';
      await groq.synthesizeResponses(input, analyses, (content) => {
        finalContent = content;
        setMessages(prev => {
          const index = prev.findIndex(m => m.timestamp === synthesisMessage.timestamp);
          if (index === -1) return prev;

          const newMessages = [...prev];
          newMessages[index] = {
            ...synthesisMessage,
            content: `# 🌟 Integrated Synthesis\n\n${content}`
          };
          return newMessages;
        });
      });

      // Save final synthesis message
      const finalSynthesisMessage = {
        ...synthesisMessage,
        content: `# 🌟 Integrated Synthesis\n\n${finalContent}`,
        chatId: currentChatId.current
      };
      await db.addMessage(finalSynthesisMessage);

      setInput('');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process message",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!message.id) return;

    try {
      await db.deleteMessage(message.id);
      setMessages(prev => prev.filter(msg => msg.id !== message.id));
      toast({
        title: "Message Deleted",
        description: "Message was successfully removed"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive"
      });
    }
  };

  const handleExport = () => {
    const exportData = {
      messages,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mind-mosaic-chat-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Your chat history has been exported successfully"
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importData = JSON.parse(event.target?.result as string);

        if (!Array.isArray(importData.messages)) {
          throw new Error("Invalid file format: messages array not found");
        }

        // Validate each message has required fields
        const validMessages = importData.messages.every((msg: any) =>
          msg.role && msg.content && msg.timestamp && msg.chatId
        );

        if (!validMessages) {
          throw new Error("Invalid file format: messages are missing required fields");
        }

        // Generate new chatId for imported messages
        const newChatId = crypto.randomUUID();
        const newMessages = importData.messages.map((msg: ChatMessage) => ({
          ...msg,
          chatId: newChatId,
          id: undefined // Allow DB to generate new IDs
        }));

        // Add all imported messages to IndexedDB
        for (const msg of newMessages) {
          await db.addMessage(msg);
        }

        // Update state with imported messages
        setMessages(prev => [...prev, ...newMessages]);

        // Notify parent of new chat
        onChatCreated?.(newChatId);

        toast({
          title: "Import Successful",
          description: `Imported ${newMessages.length} messages`
        });

        // Clear the file input
        e.target.value = '';
      } catch (error) {
        toast({
          title: "Import Failed",
          description: error instanceof Error ? error.message : "Invalid file format",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end gap-2 p-2 border-b">
        <Input
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
          id="import-file"
        />
        <Button variant="outline" size="sm" onClick={() => document.getElementById('import-file')?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div ref={scrollAreaRef} className="flex-1 p-4 overflow-y-auto pb-24">
        {messages.map((message) => (
          <Card
            key={message.timestamp}
            className={cn(
              "mb-4 relative group max-w-[80%]",
              message.role === 'user' ? 'ml-auto' : 'mr-auto'
            )}
          >
            <CardContent className={cn(
              "p-4",
              message.role === 'user' ? 'bg-primary/10' : 'bg-muted'
            )}>
              <div className="font-semibold mb-2 flex justify-between items-center">
                <span>{message.role === 'user' ? '👤 You' : '🤖 Assistant'}</span>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            const text = message.reasoning_content || message.content;
                            navigator.clipboard.writeText(text);
                            toast({
                              title: "Copied",
                              description: "Message content copied to clipboard",
                            });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy message</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={() => handleDeleteMessage(message)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete message</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              {message.role === 'assistant' && message.reasoning_content ? (
                <ReasonerView
                  content={message.content}
                  reasoningContent={message.reasoning_content}
                />
              ) : (
                <ReactMarkdown className="prose prose-sm max-w-none">
                  {message.content}
                </ReactMarkdown>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t fixed bottom-0 left-0 right-0 bg-background">
        <div className="flex gap-2 max-w-none mx-auto">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
          />
          <Button type="submit" disabled={loading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}