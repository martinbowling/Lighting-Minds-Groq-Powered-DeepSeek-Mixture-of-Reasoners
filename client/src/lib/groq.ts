import type { ChatMessage, Reasoner } from './db';

interface GroqConfig {
  apiKey: string;
  apiUrl: string;
}

export class GroqClient {
  constructor(private config: GroqConfig) {}

  private async makeRequest(prompt: string) {
    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "deepseek-r1-distill-llama-70b",
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getReasoners(message: string): Promise<Reasoner[]> {
    const prompt = `For this question: "${message}", suggest 3-4 analysis perspectives. 
Return format: "EMOJI PerspectiveName, EMOJI PerspectiveName". 
Examples: 
- 🔬 Materials Scientist, ⚖️ Ethicist, 🌍 Environmental Economist
- 🤖 AI Safety Researcher, 📜 Historian, 💼 Policy Maker`;

    const response = await this.makeRequest(prompt);
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

Structure:
1. Core principles
2. Analysis approach
3. Key insights
4. Potential blindspots

Keep response under 500 words.`;

    const response = await this.makeRequest(prompt);
    return response.choices[0].message.content;
  }

  async synthesizeResponses(message: string, responses: { reasoner: Reasoner, analysis: string }[]): Promise<string> {
    const perspectives = responses.map(r => 
      `${r.reasoner.emoji} **${r.reasoner.name}**: ${r.analysis}`
    ).join('\n\n');

    const prompt = `Synthesize these perspectives on "${message}":\n\n${perspectives}\n\n
Create integrated analysis that:
1. Identifies common ground
2. Highlights key differences
3. Notes critical insights
4. Proposes balanced conclusions
Use markdown with emojis for section headers.`;

    const response = await this.makeRequest(prompt);
    return response.choices[0].message.content;
  }
}
