"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthService } from '@/lib/services/auth-service';
import { UserService } from '@/lib/services/user-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { Copy } from 'lucide-react';

export default function UserDetails({ params }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const isAuthenticated = await AuthService.isAuthenticated();
        if (!isAuthenticated) {
          router.replace('/login');
          return;
        }

        const user = AuthService.getStoredUser();
        if (!user?.is_admin) {
          router.replace('/dashboard');
          return;
        }

        setCurrentUser(user);
        const userDetails = await UserService.getUserDetails(params.id);
        setUserData(userDetails);
      } catch (error) {
        console.error('Error loading user details:', error);
        toast.error('خطا در بارگذاری اطلاعات');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadData();
  }, [router, params.id]);

  const copyToClipboard = (text, message) => {
    navigator.clipboard.writeText(text);
    toast.success(message);
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
    <DashboardLayout user={currentUser}>
      <div className="p-6 space-y-6">
        {/* User Profile */}
        <Card>
          <CardHeader>
            <CardTitle>پروفایل کاربر</CardTitle>
            <CardDescription>اطلاعات کامل پروفایل کاربر</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>نام و نام خانوادگی</Label>
                <Input value={userData?.name} readOnly />
              </div>
              <div>
                <Label>ایمیل</Label>
                <Input value={userData?.email} readOnly />
              </div>
              <div>
                <Label>شماره تلفن</Label>
                <Input value={userData?.phone_number || '-'} readOnly />
              </div>
              <div>
                <Label>وضعیت اتصال تلگرام</Label>
                <Input 
                  value={userData?.telegram_session ? 'متصل' : 'غیر متصل'} 
                  className={userData?.telegram_session ? 'text-success' : 'text-destructive'}
                  readOnly 
                />
              </div>
            </div>

            {/* API Keys and Sessions */}
            <div className="space-y-4 mt-6">
              <div>
                <Label>کلید API جیمنای</Label>
                <div className="flex gap-2">
                  <Input value={userData?.gemini_api_key || '-'} readOnly />
                  {userData?.gemini_api_key && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(userData.gemini_api_key, 'کلید API کپی شد')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label>سشن تلگرام</Label>
                <div className="flex gap-2">
                  <Input value={userData?.telegram_session || '-'} readOnly />
                  {userData?.telegram_session && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(userData.telegram_session, 'سشن تلگرام کپی شد')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Services */}
        <Card>
          <CardHeader>
            <CardTitle>سرویس‌های کاربر</CardTitle>
            <CardDescription>لیست تمامی سرویس‌های تعریف شده توسط کاربر</CardDescription>
          </CardHeader>
          <CardContent>
            {userData?.services?.length > 0 ? (
              <div className="space-y-4">
                {userData.services.map((service) => (
                  <Card key={service.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold">{service.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-sm ${service.is_active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                            {service.is_active ? 'فعال' : 'غیرفعال'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <Label>کانال‌های مبدا</Label>
                            <div className="mt-1">
                              {JSON.parse(service.source_channels).join(', ')}
                            </div>
                          </div>
                          <div>
                            <Label>کانال‌های مقصد</Label>
                            <div className="mt-1">
                              {JSON.parse(service.target_channels).join(', ')}
                            </div>
                          </div>
                        </div>
                        {service.prompt_template && (
                          <div className="mt-4">
                            <Label>قالب پرامپت</Label>
                            <div className="mt-1 p-2 bg-muted rounded-md">
                              {service.prompt_template}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                هیچ سرویسی یافت نشد
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}