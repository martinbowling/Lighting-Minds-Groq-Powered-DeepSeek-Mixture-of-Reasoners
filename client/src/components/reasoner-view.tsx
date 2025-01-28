import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { db } from '@/lib/db';
import ReactMarkdown from 'react-markdown';

interface ReasonerViewProps {
  content: string;
  reasoningContent: string;
}

export function ReasonerView({ content, reasoningContent }: ReasonerViewProps) {
  const [showReasoning, setShowReasoning] = useState(false);

  useEffect(() => {
    db.getSettings().then(settings => {
      setShowReasoning(settings.showReasoningContent);
    });
  }, []);

  if (!showReasoning) {
    return (
      <ReactMarkdown className="prose prose-sm max-w-none">
        {content}
      </ReactMarkdown>
    );
  }

  return (
    <Tabs defaultValue="synthesis">
      <TabsList>
        <TabsTrigger value="synthesis">Synthesis</TabsTrigger>
        <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
      </TabsList>

      <TabsContent value="synthesis">
        <ReactMarkdown className="prose prose-sm max-w-none">
          {content}
        </ReactMarkdown>
      </TabsContent>

      <TabsContent value="reasoning">
        <ReactMarkdown className="prose prose-sm max-w-none">
          {reasoningContent}
        </ReactMarkdown>
      </TabsContent>
    </Tabs>
  );
}
