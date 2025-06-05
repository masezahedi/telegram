// app/(dashboard)/dashboard/page.js
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserService } from '@/lib/services/user-service';
import { AuthService } from '@/lib/services/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import TelegramConnection from '@/components/dashboard/telegram-connection';

export default function Dashboard() {
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

      // Always fetch fresh user data from API to ensure consistency
      const userDataResponse = await UserService.getCurrentUser();
      if (userDataResponse?.user) {
        // Update localStorage with fresh data
        localStorage.setItem("user", JSON.stringify({
          ...userDataResponse.user,
          isTelegramConnected: Boolean(userDataResponse.user.telegram_session), // Use telegram_session from API response
          isAdmin: Boolean(userDataResponse.user.is_admin), // Corrected to is_admin from API
          isPremium: Boolean(userDataResponse.user.is_premium), // Corrected to is_premium from API
        }));
        setUser(AuthService.getStoredUser()); // Get the normalized user object from local storage
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
      // If not successful, navigation already handled
    };

    checkAuthAndLoadUser();

    // Setup polling interval
    const intervalId = setInterval(fetchUserData, 60 * 1000); // Poll every 1 minute

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [router]);

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser); // Update the user state in the Dashboard page
  };

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
            <CardTitle>اتصال به تلگرام</CardTitle>
            <CardDescription>
              برای استفاده از سرویس‌های تلگرام، حساب خود را متصل کنید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TelegramConnection user={user} onUserUpdate={handleUserUpdate} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}