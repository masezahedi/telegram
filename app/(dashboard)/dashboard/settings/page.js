"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthService } from '@/lib/services/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import ApiKeySettings from '@/components/dashboard/settings/api-key-settings';

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndLoadUser = async () => {
      try {
        const isAuthenticated = await AuthService.isAuthenticated();
        if (!isAuthenticated) {
          router.replace('/login');
          return;
        }

        setUser(AuthService.getStoredUser());
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('خطا در بارگذاری تنظیمات');
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadUser();
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-r-transparent animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>تنظیمات</CardTitle>
            <CardDescription>
              تنظیمات حساب کاربری و سرویس‌های خود را مدیریت کنید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeySettings />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}