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

  useEffect(() => {
    const checkAuthAndLoadUser = async () => {
      try {
        const isAuthenticated = await AuthService.isAuthenticated();
        
        if (!isAuthenticated) {
          router.replace('/login');
          return;
        }

        // Get stored user data on client side
        const storedUser = AuthService.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        } else {
          const userData = await UserService.getCurrentUser();
          if (userData) {
            setUser(userData);
          } else {
            router.replace('/login');
          }
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        toast.error('خطا در بارگذاری اطلاعات');
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
            <CardTitle>اتصال به تلگرام</CardTitle>
            <CardDescription>
              برای استفاده از سرویس‌های تلگرام، حساب خود را متصل کنید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TelegramConnection user={user} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}