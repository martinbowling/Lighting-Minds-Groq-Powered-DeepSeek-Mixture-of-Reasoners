import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Download, Upload, Copy } from 'lucide-react';
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
}

export function ChatInterface({ messages, setMessages }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, []);

  // Auto-scroll when messages change
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

      // Add user message
      const userMessage: ChatMessage = {
        role: 'user',
        content: input,
        timestamp: Date.now()
      };
      await db.addMessage(userMessage);
      setMessages(prev => [...prev, userMessage]);

      // Add initial status message
      const statusMessage: StreamingMessage = {
        role: 'assistant',
        content: '🔍 Analyzing your question...',
        timestamp: Date.now()
      };
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
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          ...statusMessage,
          content: '✨ Perspectives chosen:\n\n' + reasonerList.map(
            r => `${r.emoji} ${r.name}`
          ).join('\n')
        }
      ]);

      // Process each perspective
      const analyses: Array<{ reasoner: Reasoner; analysis: string }> = [];

      for (const reasoner of reasonerList) {
        // Add new message for this reasoner
        const analysisMessage: StreamingMessage = {
          role: 'assistant',
          content: `### ${reasoner.emoji} ${reasoner.name}'s Analysis\n\nAnalyzing...`,
          timestamp: Date.now(),
          isComplete: false
        };
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

        // Mark message as complete
        setMessages(prev => {
          const index = prev.findIndex(m => m.timestamp === analysisMessage.timestamp);
          if (index === -1) return prev;

          const newMessages = [...prev];
          newMessages[index] = {
            ...newMessages[index],
            isComplete: true
          };
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
        ).join('\n\n')
      };
      setMessages(prev => [...prev, synthesisMessage]);

      // Stream in the synthesis
      await groq.synthesizeResponses(input, analyses, (content) => {
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

      // Save all messages to the database
      for (const msg of messages) {
        if (msg.isComplete !== false) {
          try {
            await db.addMessage({
              ...msg,
              timestamp: msg.timestamp || Date.now()
            });
          } catch (error) {
            console.error('Error saving message:', error);
          }
        }
      }

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

  const handleExport = () => {
    const exportData = {
      messages,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importData = JSON.parse(event.target?.result as string);
        const newMessages = importData.messages;

        // Add all imported messages to IndexedDB
        for (const msg of newMessages) {
          await db.addMessage(msg);
        }

        // Update state
        setMessages(prev => [...prev, ...newMessages]);

        toast({
          title: "Import Successful",
          description: `Imported ${newMessages.length} messages`
        });
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Invalid file format",
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

      <div ref={scrollAreaRef} className="flex-1 p-4 overflow-y-auto">
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

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
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