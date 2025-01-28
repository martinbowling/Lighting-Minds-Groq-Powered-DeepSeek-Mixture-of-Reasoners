export interface Settings {
  apiKey: string;
  showReasoningContent: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning_content?: string;
  timestamp: number;
  id?: string;
}

export interface Reasoner {
  emoji: string;
  name: string;
}

class Database {
  private db: IDBDatabase | null = null;
  private initialized = false;

  async init() {
    if (this.initialized) return;

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('chatbot_db', 2);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        if (db.objectStoreNames.contains('messages')) {
          db.deleteObjectStore('messages');
        }

        const messagesStore = db.createObjectStore('messages', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        messagesStore.createIndex('by_timestamp', 'timestamp');
      };
    });
  }

  async getSettings(): Promise<Settings> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('user_settings');

      request.onsuccess = () => {
        resolve(request.result || {
          apiKey: '',
          showReasoningContent: false
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('settings', 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put(settings, 'user_settings');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(): Promise<ChatMessage[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_timestamp');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addMessage(message: ChatMessage): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.add({
        ...message,
        timestamp: message.timestamp || Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMessage(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearMessages(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new Database();