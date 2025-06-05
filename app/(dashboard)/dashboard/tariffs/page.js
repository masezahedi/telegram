"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AuthService } from "@/lib/services/auth-service";
import { TariffService } from "@/lib/services/tariff-service"; 
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import DashboardLayout from "@/components/dashboard/dashboard-layout";

const formSchema = z.object({
  normal_user_trial_days: z.coerce.number().min(0, "تعداد روز باید مثبت یا صفر باشد."),
  premium_user_default_days: z.coerce.number().min(0, "تعداد روز باید مثبت یا صفر باشد."),
  normal_user_max_active_services: z.coerce.number().min(0, "تعداد سرویس باید مثبت یا صفر باشد."),
  premium_user_max_active_services: z.coerce.number().min(0, "تعداد سرویس باید مثبت یا صفر باشد."),
  normal_user_max_channels_per_service: z.coerce.number().min(0, "تعداد کانال باید مثبت یا صفر باشد."),
  premium_user_max_channels_per_service: z.coerce.number().min(0, "تعداد کانال باید مثبت یا صفر باشد."),
  premium_price: z.coerce.number().min(0, "مبلغ باید مثبت یا صفر باشد."), // NEW: Premium price field
});

export default function TariffSettings() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      normal_user_trial_days: 0,
      premium_user_default_days: 0,
      normal_user_max_active_services: 0,
      premium_user_max_active_services: 0,
      normal_user_max_channels_per_service: 0,
      premium_user_max_channels_per_service: 0,
      premium_price: 0, // NEW: Default value for premium price
    },
  });

  useEffect(() => {
    const checkAuthAndLoadSettings = async () => {
      setLoading(true);
      try {
        const isAuthenticated = await AuthService.isAuthenticated();
        if (!isAuthenticated) {
          router.replace("/login");
          return;
        }

        const loggedInUser = AuthService.getStoredUser();
        if (!loggedInUser?.isAdmin) {
          toast.error("دسترسی غیر مجاز. شما ادمین نیستید.");
          router.replace("/dashboard");
          return;
        }
        setCurrentUser(loggedInUser);

        const settings = await TariffService.getTariffSettings();
        if (settings) {
          form.reset({
            normal_user_trial_days: settings.normal_user_trial_days,
            premium_user_default_days: settings.premium_user_default_days,
            normal_user_max_active_services: settings.normal_user_max_active_services,
            premium_user_max_active_services: settings.premium_user_max_active_services,
            normal_user_max_channels_per_service: settings.normal_user_max_channels_per_service,
            premium_user_max_channels_per_service: settings.premium_user_max_channels_per_service,
            premium_price: settings.premium_price, // NEW: Set premium price
          });
        }
      } catch (error) {
        console.error("Error loading tariff settings:", error);
        toast.error("خطا در بارگذاری تنظیمات تعرفه.");
        router.replace("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadSettings();
  }, [router, form]);

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      const result = await TariffService.updateTariffSettings(values);
      if (result.success) {
        toast.success("تنظیمات تعرفه با موفقیت به‌روزرسانی شد.");
      } else {
        toast.error(result.message || "خطا در به‌روزرسانی تنظیمات تعرفه.");
      }
    } catch (error) {
      console.error("Update tariff settings error:", error);
      toast.error("خطا در به‌روزرسانی تنظیمات تعرفه.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout user={currentUser}>
        <div className="h-full flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-r-transparent animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={currentUser}>
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>مدیریت تعرفه‌ها</CardTitle>
            <CardDescription>
              تنظیمات مربوط به محدودیت‌ها و مدت زمان استفاده کاربران
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="normal_user_trial_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>مدت زمان مهلت کاربران عادی (روز)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min="0" />
                        </FormControl>
                        <FormDescription>
                          تعداد روزهای مهلت استفاده برای کاربران عادی پس از فعال‌سازی اولین سرویس.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="premium_user_default_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>مدت زمان پیش‌فرض کاربران پرمیوم (روز)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min="0" />
                        </FormControl>
                        <FormDescription>
                          تعداد روزهای پیش‌فرض اشتراک برای کاربران پرمیوم (اگر تاریخ انقضا دستی تنظیم نشده باشد).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="normal_user_max_active_services"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>حداکثر سرویس فعال (کاربر عادی)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min="0" />
                        </FormControl>
                        <FormDescription>
                          حداکثر تعداد سرویس‌های فوروارد/کپی که یک کاربر عادی می‌تواند همزمان فعال داشته باشد.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="premium_user_max_active_services"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>حداکثر سرویس فعال (کاربر پرمیوم)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min="0" />
                        </FormControl>
                        <FormDescription>
                          حداکثر تعداد سرویس‌های فوروارد/کپی که یک کاربر پرمیوم می‌تواند همزمان فعال داشته باشد.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                    <FormField
                    control={form.control}
                    name="normal_user_max_channels_per_service"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>حداکثر کانال در هر سرویس (کاربر عادی)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min="0" />
                        </FormControl>
                        <FormDescription>
                          حداکثر تعداد کانال‌های مبدا و مقصد که یک کاربر عادی می‌تواند در یک سرویس تعریف کند.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="premium_user_max_channels_per_service"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>حداکثر کانال در هر سرویس (کاربر پرمیوم)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min="0" />
                        </FormControl>
                        <FormDescription>
                          حداکثر تعداد کانال‌های مبدا و مقصد که یک کاربر پرمیوم می‌تواند در یک سرویس تعریف کند.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   {/* NEW: Premium Price Field */}
                  <FormField
                    control={form.control}
                    name="premium_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>مبلغ قابل پرداخت پرمیوم (تومان)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min="0" />
                        </FormControl>
                        <FormDescription>
                          مبلغی که کاربران برای ارتقا به حساب پرمیوم پرداخت می‌کنند.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "در حال ذخیره..." : "ذخیره تنظیمات تعرفه"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}