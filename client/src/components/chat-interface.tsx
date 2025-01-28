import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ChatMessage } from '@/lib/db';
import { db } from '@/lib/db';
import { GroqClient } from '@/lib/groq';
import { ReasonerView } from './reasoner-view';
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
    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    try {
      const groq = new GroqClient({
        apiKey: settings.apiKey,
        apiUrl: settings.apiUrl
      });

      // Get reasoners
      const reasoners = await groq.getReasoners(input);
      const analyses = await Promise.all(
        reasoners.map(async (reasoner) => ({
          reasoner,
          analysis: await groq.getReasonerAnalysis(input, reasoner)
        }))
      );

      // Get synthesis
      const synthesis = await groq.synthesizeResponses(input, analyses);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: synthesis,
        reasoning_content: analyses.map(a => 
          `${a.reasoner.emoji} ${a.reasoner.name}\n${a.analysis}`
        ).join('\n\n'),
        timestamp: Date.now()
      };

      await db.addMessage(userMessage);
      await db.addMessage(assistantMessage);
      
      setMessages(prev => [...prev, userMessage, assistantMessage]);
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

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        {messages.map((message, i) => (
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
