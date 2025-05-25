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
  name: z.string().min(2, {
    message: 'نام باید حداقل ۲ کاراکتر باشد.',
  }),
  email: z.string().email({
    message: 'لطفاً یک ایمیل معتبر وارد کنید.',
  }),
  password: z.string().min(8, {
    message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.',
  }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'رمزهای عبور یکسان نیستند.',
  path: ['confirmPassword'],
});

export default function Register() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      const result = await AuthService.register(values);
      if (result.success) {
        toast.success('ثبت نام با موفقیت انجام شد!');
        router.push('/login');
      } else {
        toast.error(result.message || 'خطا در ثبت نام. لطفاً دوباره تلاش کنید.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('خطا در ثبت نام. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center font-bold">ثبت نام</CardTitle>
            <CardDescription className="text-center">
              برای استفاده از سرویس‌های تلگرام، حساب کاربری بسازید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نام و نام خانوادگی</FormLabel>
                      <FormControl>
                        <Input placeholder="نام خود را وارد کنید" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تکرار رمز عبور</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'در حال ثبت نام...' : 'ثبت نام'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-center text-sm">
              قبلاً ثبت نام کرده‌اید؟{' '}
              <Link href="/login" className="text-primary hover:underline">
                ورود به حساب
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}