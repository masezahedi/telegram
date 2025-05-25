"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { SettingsService } from '@/lib/services/settings-service';

const formSchema = z.object({
  geminiApiKey: z.string().min(1, {
    message: 'کلید API الزامی است',
  }),
});

export default function ApiKeySettings() {
  const [loading, setLoading] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      geminiApiKey: '',
    },
  });

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await SettingsService.getSettings();
      if (settings?.gemini_api_key) {
        form.setValue('geminiApiKey', settings.gemini_api_key);
      }
    };
    
    loadSettings();
  }, [form]);

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      const result = await SettingsService.updateSettings({
        geminiApiKey: values.geminiApiKey,
      });
      
      if (result.success) {
        toast.success('تنظیمات با موفقیت ذخیره شد');
      } else {
        toast.error(result.error || 'خطا در ذخیره تنظیمات');
      }
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error('خطا در ذخیره تنظیمات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">تنظیمات API</h2>
        <p className="text-sm text-muted-foreground">
          برای استفاده از قابلیت‌های هوش مصنوعی، کلید API خود را از Google AI Studio دریافت کنید.
        </p>
      </div>

      <Alert>
        <AlertDescription>
          برای دریافت کلید API به{' '}
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google AI Studio
          </a>
          {' '}مراجعه کنید.
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="geminiApiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>کلید API جیمنای</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder="کلید API خود را وارد کنید" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
          </Button>
        </form>
      </Form>
    </div>
  );
}