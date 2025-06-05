"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserService } from '@/lib/services/user-service';
import { AuthService } from '@/lib/services/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import ProfileSettings from '@/components/dashboard/profile-settings';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

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
          router.replace('/login');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        toast.error('خطا در بارگذاری اطلاعات');
        router.replace('/login');
      } finally {
        setLoading(false);
        setIsAuthChecked(true);
      }
    };

    checkAuthAndLoadUser();
  }, [router]);

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
    toast.success('پروفایل با موفقیت بروزرسانی شد');
  };

  if (!isAuthChecked || loading) {
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
            <CardTitle>تنظیمات پروفایل</CardTitle>
            <CardDescription>
              اطلاعات حساب کاربری خود را مدیریت کنید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileSettings user={user} onUpdate={handleProfileUpdate} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}