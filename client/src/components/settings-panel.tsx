import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db, type Settings } from '@/lib/db';

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>({
    apiKey: '',
    showReasoningContent: false
  });
  const { toast } = useToast();

  useEffect(() => {
    db.getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    try {
      await db.saveSettings(settings);
      toast({
        title: "Settings saved",
        description: "Your changes have been saved successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiKey">Groq API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={settings.apiKey}
            onChange={e => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder="sk_..."
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showReasoning">Show Reasoning Content</Label>
          <Switch
            id="showReasoning"
            checked={settings.showReasoningContent}
            onCheckedChange={checked => 
              setSettings(prev => ({ ...prev, showReasoningContent: checked }))
            }
          />
        </div>

        <Button onClick={handleSave} className="w-full">
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}