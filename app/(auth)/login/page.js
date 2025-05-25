"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { AuthService } from '@/lib/services/auth-service';

const formSchema = z.object({
  email: z.string().email({
    message: 'لطفاً یک ایمیل معتبر وارد کنید.',
  }),
  password: z.string().min(1, {
    message: 'رمز عبور الزامی است.',
  }),
});

export default function Login() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      const result = await AuthService.login(values);
      if (result.success) {
        // Navigate to dashboard without showing toast yet
        await router.replace('/dashboard');
        // Show success message after navigation
        toast.success('ورود با موفقیت انجام شد!');
      } else {
        toast.error(result.message || 'ایمیل یا رمز عبور اشتباه است.');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('خطا در ورود. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center font-bold">ورود به حساب</CardTitle>
            <CardDescription className="text-center">
              برای استفاده از سرویس‌های تلگرام، وارد حساب خود شوید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ایمیل</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رمز عبور</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'در حال ورود...' : 'ورود'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-center text-sm">
              حساب کاربری ندارید؟{' '}
              <Link href="/register" className="text-primary hover:underline">
                ثبت نام
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}