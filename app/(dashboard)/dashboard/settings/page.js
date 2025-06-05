// app/(dashboard)/dashboard/settings/page.js
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserService } from '@/lib/services/user-service';
import { AuthService } from '@/lib/services/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import ApiKeySettings from '@/components/dashboard/settings/api-key-settings';

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async () => {
    try {
      const isAuthenticated = await AuthService.isAuthenticated();
      if (!isAuthenticated) {
        router.replace('/login');
        return false;
      }

      const userDataResponse = await UserService.getCurrentUser();
      if (userDataResponse?.user) {
        localStorage.setItem("user", JSON.stringify({
          ...userDataResponse.user,
          isTelegramConnected: Boolean(userDataResponse.user.telegram_session), // Use telegram_session
          isAdmin: Boolean(userDataResponse.user.is_admin), // Corrected to is_admin
          isPremium: Boolean(userDataResponse.user.is_premium), // Corrected to is_premium
        }));
        setUser(AuthService.getStoredUser());
        return true;
      } else {
        router.replace('/login');
        return false;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('خطا در بارگذاری اطلاعات کاربر');
      router.replace('/login');
      return false;
    }
  };

  useEffect(() => {
    const checkAuthAndLoadUser = async () => {
      setLoading(true);
      const success = await fetchUserData();
      setLoading(false);
    };

    checkAuthAndLoadUser();

    // Setup polling interval
    const intervalId = setInterval(fetchUserData, 60 * 1000); // Poll every 1 minute

    return () => clearInterval(intervalId); // Cleanup on unmount
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