import { Groq as GroqSDK } from 'groq-sdk';
import type { ChatMessage, Reasoner } from './db';

interface GroqConfig {
  apiKey: string;
}

type StreamCallback = (chunk: string) => void;

export class GroqClient {
  private client: GroqSDK;

  constructor(private config: GroqConfig) {
    this.client = new GroqSDK({ 
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true // Required for browser environment
    });
  }

  async getReasoners(message: string, onUpdate?: StreamCallback): Promise<Reasoner[]> {
    const prompt = `For this question: "${message}", determine 3-4 essential analytical perspectives.
Return only the list in format: "EMOJI PerspectiveName, EMOJI PerspectiveName"
Example: "🔬 Technical Analyst, ⚖️ Legal Expert, 🌍 Environmental Scientist"
Focus on perspectives that will provide unique and valuable insights.`;

    try {
      const response = await this.client.chat.completions.create({
        model: "llama-3.3-70b-specdec",
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 150,
        stream: true
      });

      let content = '';
      for await (const chunk of response) {
        if (chunk.choices[0]?.delta?.content) {
          content += chunk.choices[0].delta.content;
          onUpdate?.(content);
        }
      }

      const entries = content.split(',').map(e => e.trim());
      return entries.map(entry => {
        if (entry.length < 2) return { emoji: '🧠', name: entry };
        const [emoji, ...nameParts] = entry.split(' ');
        return {
          emoji: emoji.trim(),
          name: nameParts.join(' ').trim()
        };
      }).slice(0, 4);
    } catch (error) {
      console.error('Error getting reasoners:', error);
      throw error;
    }
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

    try {
      const response = await this.client.chat.completions.create({
        model: "deepseek-r1-distill-llama-70b",
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
        stream: true
      });

      let content = '';
      for await (const chunk of response) {
        if (chunk.choices[0]?.delta?.content) {
          content += chunk.choices[0].delta.content;
          onUpdate?.(content);
        }
      }
      return content;
    } catch (error) {
      console.error('Error getting analysis:', error);
      throw error;
    }
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

    try {
      const response = await this.client.chat.completions.create({
        model: "deepseek-r1-distill-llama-70b",
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
        stream: true
      });

      let content = '';
      for await (const chunk of response) {
        if (chunk.choices[0]?.delta?.content) {
          content += chunk.choices[0].delta.content;
          onUpdate?.(content);
        }
      }
      return content;
    } catch (error) {
      console.error('Error getting synthesis:', error);
      throw error;
    }
  }
}