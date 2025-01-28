# ⚡ Lightning Minds

A sophisticated multi-perspective AI chatbot leveraging the Groq API to provide advanced conversational experiences through an interactive web interface.

## 🌟 Features

- **Multi-Perspective Analysis**: Analyzes queries from multiple expert viewpoints
- **Real-Time Streaming**: Stream responses as they're generated
- **Chat Management**: Create, save, and manage multiple chat sessions
- **Export/Import**: Save and load your chat history
- **Interactive UI**: Clean, responsive interface with dark mode support
- **Reasoning Visualization**: Option to view the detailed reasoning process

## 🛠️ Technical Architecture

### Frontend (React + TypeScript)

#### Core Components

1. **ChatInterface (`chat-interface.tsx`)**
   - Manages the main chat interaction
   - Handles message streaming and display
   - Implements export/import functionality
   - Communicates with Groq API through the GroqClient

2. **ChatSidebar (`chat-sidebar.tsx`)**
   - Manages chat history and navigation
   - Provides chat deletion and switching functionality
   - Shows chat previews organized by date

3. **SettingsPanel (`settings-panel.tsx`)**
   - Manages API key configuration
   - Controls reasoning content visibility
   - Persists settings in IndexedDB

### Data Layer

#### IndexedDB Structure (`db.ts`)
- **Settings Store**: Stores API keys and user preferences
- **Messages Store**: 
  - Stores chat messages with their metadata
  - Indexes for efficient querying by timestamp and chat ID
  - Supports CRUD operations for messages

#### Data Models
```typescript
interface ChatMessage {
  id?: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning_content?: string;
  timestamp: number;
}

interface Settings {
  apiKey: string;
  showReasoningContent: boolean;
}

interface Reasoner {
  emoji: string;
  name: string;
}
```

### Groq Integration (`groq.ts`)

The GroqClient class manages all interactions with the Groq API, implementing three main methods:

1. **getReasoners**: 
   - Determines relevant analytical perspectives for a question
   - Returns 3-4 expert personas with emojis

2. **getReasonerAnalysis**:
   - Generates analysis from each expert's perspective
   - Structures output with core principles, observations, implications, and limitations

3. **synthesizeResponses**:
   - Combines multiple expert analyses
   - Creates a balanced synthesis highlighting key agreements and tensions

## 🔄 Message Flow

1. **User Input**
   - User submits a question
   - Input is validated and API key is checked

2. **Analysis Process**
   ```
   User Question
   ↓
   Get Reasoners (3-4 perspectives)
   ↓
   Individual Analysis (per reasoner)
   ↓
   Synthesis of All Perspectives
   ↓
   Final Response
   ```

3. **Response Handling**
   - All responses are streamed in real-time
   - Messages are saved to IndexedDB
   - UI updates progressively as content arrives

## 💾 Data Persistence

### Export Format
```json
{
  "messages": [
    {
      "role": "user|assistant",
      "content": "message content",
      "reasoning_content": "optional detailed analysis",
      "timestamp": 1234567890,
      "chatId": "uuid"
    }
  ],
  "exportDate": "ISO date string",
  "version": "1.0"
}
```

### Import Process
1. Validates file format and required fields
2. Generates new chat ID for imported messages
3. Stores messages in IndexedDB
4. Updates UI to show imported chat

## 🚀 Implementation Details

### State Management
- React's useState and useEffect for component state
- IndexedDB for persistent storage
- Real-time updates using streaming responses

### Error Handling
- Comprehensive error catching in API calls
- User-friendly error messages via toast notifications
- Graceful degradation when services are unavailable

### UI/UX Considerations
- Responsive design for all screen sizes
- Loading states and progress indicators
- Clear visual hierarchy for message types
- Intuitive navigation between chats

## 🔒 Security Considerations

- API keys stored securely in IndexedDB
- No sensitive data exposed in exports
- Client-side only storage for privacy
- Sanitized markdown rendering

## 🎯 Future Enhancements

- Additional reasoning visualization options
- Enhanced export formats (PDF, HTML)
- Collaborative features
- Custom expert persona definitions
- Integration with additional LLM providers
