import type { ChatMessage, Reasoner } from './db';

interface GroqConfig {
  apiKey: string;
  apiUrl: string;
}

type StreamCallback = (chunk: string) => void;

export class GroqClient {
  constructor(private config: GroqConfig) {}

  private async makeStreamingRequest(prompt: string, options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    onChunk?: StreamCallback;
  } = {}) {
    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || "llama-3.3-70b-specdec",
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} - ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(5);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const chunkContent = parsed.choices[0]?.delta?.content || '';
              content += chunkContent;
              options.onChunk?.(content);
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return content;
  }

  async getReasoners(message: string, onUpdate?: StreamCallback): Promise<Reasoner[]> {
    const prompt = `For this question: "${message}", determine 3-4 essential analytical perspectives.
Return only the list in format: "EMOJI PerspectiveName, EMOJI PerspectiveName"
Example: "🔬 Technical Analyst, ⚖️ Legal Expert, 🌍 Environmental Scientist"
Focus on perspectives that will provide unique and valuable insights.`;

    const content = await this.makeStreamingRequest(prompt, {
      model: "llama-3.3-70b-specdec",
      max_tokens: 150,
      onChunk: onUpdate,
    });

    const entries = content.split(',').map((e: string) => e.trim());
    return entries.map((entry: string) => {
      if (entry.length < 2) return { emoji: '🧠', name: entry };
      const [emoji, ...nameParts] = entry.split(' ');
      return {
        emoji: emoji.trim(),
        name: nameParts.join(' ').trim()
      };
    }).slice(0, 4);
  }

  async getReasonerAnalysis(message: string, reasoner: Reasoner, onUpdate?: StreamCallback): Promise<string> {
    const prompt = `As ${reasoner.emoji} ${reasoner.name}, analyze:
${message}

Provide your analysis in this structure:
1. Core principles and methodology
2. Key observations
3. Critical implications
4. Potential limitations

Maintain focus on your specific domain expertise while acknowledging interconnections.`;

    return this.makeStreamingRequest(prompt, {
      model: "deepseek-r1-distill-llama-70b",
      onChunk: onUpdate,
    });
  }

  async synthesizeResponses(
    message: string, 
    responses: { reasoner: Reasoner, analysis: string }[],
    onUpdate?: StreamCallback
  ): Promise<string> {
    const formatted_responses = responses.map(r => 
      `${r.reasoner.emoji} ${r.reasoner.name}:\n${r.analysis}`
    ).join('\n\n');

    const prompt = `Given these expert analyses on the question "${message}":

${formatted_responses}

Create a balanced synthesis that:
1. Highlights key agreements and tensions
2. Identifies practical implications
3. Notes important considerations and tradeoffs

Focus on actionable insights while acknowledging complexity.`;

    return this.makeStreamingRequest(prompt, {
      model: "deepseek-r1-distill-llama-70b",
      max_tokens: 2048,
      onChunk: onUpdate,
    });
  }
}