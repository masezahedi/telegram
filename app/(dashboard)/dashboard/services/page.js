"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthService } from '@/lib/services/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import ForwardingServiceForm from '@/components/dashboard/services/forwarding-service-form';
import ForwardingServiceList from '@/components/dashboard/services/forwarding-service-list';

export default function Services() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

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
        console.error('Error loading services:', error);
        toast.error('خطا در بارگذاری سرویس‌ها');
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadUser();
  }, [router]);

  const handleServiceCreated = () => {
    setKey(prev => prev + 1);
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
            <CardTitle>سرویس‌های فوروارد</CardTitle>
            <CardDescription>
              سرویس‌های فوروارد خود را مدیریت کنید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="list">
              <TabsList className="mb-4">
                <TabsTrigger value="list">لیست سرویس‌ها</TabsTrigger>
                <TabsTrigger value="create">ایجاد سرویس جدید</TabsTrigger>
              </TabsList>
              
              <TabsContent value="list">
                <ForwardingServiceList key={key} onUpdate={handleServiceCreated} />
              </TabsContent>
              
              <TabsContent value="create">
                <ForwardingServiceForm onSuccess={handleServiceCreated} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}