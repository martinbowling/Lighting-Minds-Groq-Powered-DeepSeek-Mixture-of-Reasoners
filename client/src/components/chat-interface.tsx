import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ChatMessage } from '@/lib/db';
import { db } from '@/lib/db';
import { GroqClient } from '@/lib/groq';
import { ReasonerView } from '@/components/reasoner-view';
import ReactMarkdown from 'react-markdown';

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    db.getMessages().then(setMessages);
  }, []);

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
        apiUrl: settings.apiUrl
      });

      // Add user message
      const userMessage: ChatMessage = {
        role: 'user',
        content: input,
        timestamp: Date.now()
      };
      await db.addMessage(userMessage);
      setMessages(prev => [...prev, userMessage]);

      // Add status message for reasoners
      const reasonerStatusMsg: ChatMessage = {
        role: 'assistant',
        content: '🔍 Identifying perspectives...',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, reasonerStatusMsg]);

      // Get reasoners with streaming updates
      const reasonerList = await groq.getReasoners(input, (content) => {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { ...reasonerStatusMsg, content: `🔍 Identifying perspectives...\n${content}` }
        ]);
      });

      // Collect analyses with streaming updates
      const analyses = [];
      for (const reasoner of reasonerList) {
        const analysisMsg: ChatMessage = {
          role: 'assistant',
          content: `💭 Getting ${reasoner.emoji} ${reasoner.name}'s analysis...`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev.slice(0, -1), analysisMsg]);

        const analysis = await groq.getReasonerAnalysis(input, reasoner, (content) => {
          setMessages(prev => [
            ...prev.slice(0, -1),
            {
              ...analysisMsg,
              content: `### ${reasoner.emoji} ${reasoner.name}'s Analysis\n\n${content}`
            }
          ]);
        });

        analyses.push({
          reasoner,
          analysis
        });
      }

      // Get synthesis with streaming updates
      const synthesisMsg: ChatMessage = {
        role: 'assistant',
        content: '🌟 Creating integrated synthesis...',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev.slice(0, -1), synthesisMsg]);

      const synthesis = await groq.synthesizeResponses(input, analyses, (content) => {
        setMessages(prev => [
          ...prev.slice(0, -1),
          {
            ...synthesisMsg,
            content: content,
            reasoning_content: analyses.map(a =>
              `### ${a.reasoner.emoji} ${a.reasoner.name}\n\n${a.analysis}`
            ).join('\n\n')
          }
        ]);
      });

      // Save final message
      const finalMessage: ChatMessage = {
        role: 'assistant',
        content: synthesis,
        reasoning_content: analyses.map(a =>
          `### ${a.reasoner.emoji} ${a.reasoner.name}\n\n${a.analysis}`
        ).join('\n\n'),
        timestamp: Date.now()
      };
      await db.addMessage(finalMessage);
      setInput('');

    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process message",
        variant: "destructive"
      });

      // Remove status message if there was an error
      setMessages(prev => prev.slice(0, -1));
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

      <ScrollArea className="flex-1 p-4">
        {messages.map((message) => (
          <Card key={message.timestamp} className="mb-4">
            <CardContent className="p-4">
              <div className="font-semibold mb-2">
                {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
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
      </ScrollArea>

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