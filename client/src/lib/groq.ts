import type { ChatMessage, Reasoner } from './db';

interface GroqConfig {
  apiKey: string;
  apiUrl: string;
}

export class GroqClient {
  constructor(private config: GroqConfig) {}

  private async makeRequest(prompt: string, options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
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
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getReasoners(message: string): Promise<Reasoner[]> {
    const prompt = `For this question: "${message}", determine 3-4 essential analytical perspectives.
Return only the list in format: "EMOJI PerspectiveName, EMOJI PerspectiveName"
Example: "🔬 Technical Analyst, ⚖️ Legal Expert, 🌍 Environmental Scientist"
Focus on perspectives that will provide unique and valuable insights.`;

    const response = await this.makeRequest(prompt, {
      model: "llama-3.3-70b-specdec",
      max_tokens: 150
    });

    const rawText = response.choices[0].message.content;
    const entries = rawText.split(',').map(e => e.trim());

    return entries.map(entry => {
      const [emoji, ...nameParts] = entry.split(' ');
      return {
        emoji: emoji.trim(),
        name: nameParts.join(' ').trim()
      };
    }).slice(0, 4);
  }

  async getReasonerAnalysis(message: string, reasoner: Reasoner): Promise<string> {
    const prompt = `As ${reasoner.emoji} ${reasoner.name}, analyze:
${message}

Provide your analysis in this structure:
1. Core principles and methodology
2. Key observations
3. Critical implications
4. Potential limitations

Maintain focus on your specific domain expertise while acknowledging interconnections.`;

    const response = await this.makeRequest(prompt, {
      model: "deepseek-r1-distill-llama-70b"
    });
    return response.choices[0].message.content;
  }

  async synthesizeResponses(message: string, responses: { reasoner: Reasoner, analysis: string }[]): Promise<string> {
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

    const response = await this.makeRequest(prompt, {
      model: "deepseek-r1-distill-llama-70b",
      max_tokens: 2048
    });
    return response.choices[0].message.content;
  }
}