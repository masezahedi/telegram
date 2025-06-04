"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthService } from '@/lib/services/auth-service';
import { UserService } from '@/lib/services/user-service'; // Import UserService
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

        // Fetch current user details including tariff settings
        const userDataResponse = await UserService.getCurrentUser();
        if (userDataResponse?.user) { // Access the 'user' property from the response
          // Update localStorage with fresh user data which now includes tariffSettings
          localStorage.setItem("user", JSON.stringify({
            ...userDataResponse.user,
            isTelegramConnected: Boolean(userDataResponse.user.telegramSession),
            isAdmin: Boolean(userDataResponse.user.isAdmin),
            isPremium: Boolean(userDataResponse.user.isPremium),
          }));
          setUser(AuthService.getStoredUser()); // Get the updated user object from local storage
        } else {
          // If getCurrentUser fails or returns no user, redirect to login
          router.replace('/login');
        }
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