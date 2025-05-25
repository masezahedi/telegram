"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { UserService } from '@/lib/services/user-service';

const profileSchema = z.object({
  name: z.string().min(2, {
    message: 'نام باید حداقل ۲ کاراکتر باشد.',
  }),
  email: z.string().email({
    message: 'لطفاً یک ایمیل معتبر وارد کنید.',
  }).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, {
    message: 'رمز عبور فعلی الزامی است.',
  }),
  newPassword: z.string().min(8, {
    message: 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.',
  }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'رمزهای عبور یکسان نیستند.',
  path: ['confirmPassword'],
});

export default function ProfileSettings({ user, onUpdate }) {
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  
  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmitProfile = async (values) => {
    setLoadingProfile(true);
    try {
      const result = await UserService.updateProfile(values);
      if (result.success) {
        onUpdate({ ...user, ...values });
        toast.success('پروفایل با موفقیت بروزرسانی شد!');
      } else {
        toast.error(result.message || 'خطا در بروزرسانی پروفایل. لطفاً دوباره تلاش کنید.');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('خطا در بروزرسانی پروفایل. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const onSubmitPassword = async (values) => {
    setLoadingPassword(true);
    try {
      const result = await UserService.updatePassword(values);
      if (result.success) {
        passwordForm.reset({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        toast.success('رمز عبور با موفقیت تغییر کرد!');
      } else {
        toast.error(result.message || 'خطا در تغییر رمز عبور. لطفاً دوباره تلاش کنید.');
      }
    } catch (error) {
      console.error('Update password error:', error);
      toast.error('خطا در تغییر رمز عبور. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoadingPassword(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="space-y-8">
      {/* Profile Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          <Avatar className="w-24 h-24">
            <AvatarImage src={user?.avatar || ''} alt={user?.name || 'کاربر'} />
            <AvatarFallback className="text-xl">{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
          
          <div className="space-y-2">
            <h3 className="text-xl font-medium">{user?.name || 'کاربر'}</h3>
            <p className="text-muted-foreground">{user?.email || ''}</p>
          </div>
        </div>
        
        <Separator />
        
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-4">
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام و نام خانوادگی</FormLabel>
                  <FormControl>
                    <Input placeholder="نام و نام خانوادگی خود را وارد کنید" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={profileForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ایمیل</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="email@example.com" 
                      {...field} 
                      disabled
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={loadingProfile}>
                {loadingProfile ? 'در حال بروزرسانی...' : 'بروزرسانی پروفایل'}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Password Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-medium">تغییر رمز عبور</h3>
        <Separator />
        
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4">
            <FormField
              control={passwordForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رمز عبور فعلی</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رمز عبور جدید</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تکرار رمز عبور جدید</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={loadingPassword}>
                {loadingPassword ? 'در حال تغییر رمز عبور...' : 'تغییر رمز عبور'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}