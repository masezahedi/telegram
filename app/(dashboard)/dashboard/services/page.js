// app/(dashboard)/dashboard/services/page.js (نسخه کامل و اصلاح شده)
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserService } from "@/lib/services/user-service";
import { AuthService } from "@/lib/services/auth-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import ForwardingServiceForm from "@/components/dashboard/services/forwarding-service-form";
import ForwardingServiceList from "@/components/dashboard/services/forwarding-service-list";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function Services() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0); // For re-rendering list/form if user status changes

  const fetchUserAndSetState = async () => {
    // Always fetch fresh user data to ensure up-to-date status
    const userDataResponse = await UserService.getCurrentUser();
    if (userDataResponse?.user) {
      // Update local storage with fresh data, including tariff settings
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...userDataResponse.user,
          isTelegramConnected: Boolean(userDataResponse.user.telegram_session), // Use telegram_session
          isAdmin: Boolean(userDataResponse.user.isAdmin),
          isPremium: Boolean(userDataResponse.user.isPremium),
        })
      );
      setUser(AuthService.getStoredUser()); // Get the updated user object from local storage
    } else {
      toast.error("خطا در دریافت اطلاعات کاربر.");
      router.replace("/login");
    }
  };

  useEffect(() => {
    const checkAuthAndLoadUser = async () => {
      setLoading(true);
      try {
        const isAuthenticated = await AuthService.isAuthenticated();
        if (!isAuthenticated) {
          router.replace("/login");
          return;
        }
        await fetchUserAndSetState();
      } catch (error) {
        console.error("Error loading services page:", error);
        toast.error("خطا در بارگذاری صفحه سرویس‌ها");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadUser();
  }, [router]);

  // This function will be called after a service is created/updated or status changed
  // to refresh the user state, as their trial might have started.
  const handleServiceListOrFormUpdate = async () => {
    setKey((prev) => prev + 1); // Re-render children
    await fetchUserAndSetState(); // Re-fetch user data to update expiry messages
  };

  // START: منطق جدید برای محاسبه وضعیت حساب
  let accountStatusMessage = "";
  let isAccountExpired = false;
  let alertVariant = "default";

  if (user && !user.isAdmin) {
    const now = new Date();
    const isTelegramConnected = user.isTelegramConnected;
    const isTrialActivated = Boolean(user.trialActivatedAt);
    const premiumExpiryDate = user.premiumExpiryDate
      ? new Date(user.premiumExpiryDate)
      : null;
    const normalUserTrialDays = user.tariffSettings?.normalUserTrialDays ?? 15;

    // 1. Check for expiration
    if (premiumExpiryDate && now >= premiumExpiryDate) {
      isAccountExpired = true;
    }

    // 2. Determine alert message and variant based on current state
    if (!isTelegramConnected) {
      alertVariant = "warning";
      accountStatusMessage = `برای استفاده از سرویس‌ها، لطفاً ابتدا حساب تلگرام خود را متصل کنید.`;
    } else if (isAccountExpired) {
      alertVariant = "destructive";
      accountStatusMessage = `مهلت استفاده شما از سرویس‌ها به پایان رسیده است.`;
    } else if (user.isPremium) {
      alertVariant = "default";
      accountStatusMessage = premiumExpiryDate
        ? `اشتراک پرمیوم شما تا تاریخ ${premiumExpiryDate.toLocaleDateString(
            "fa-IR",
            { year: "numeric", month: "long", day: "numeric" }
          )} معتبر است.`
        : `شما کاربر پرمیوم بدون محدودیت زمانی هستید.`;
    } else if (isTrialActivated) {
      alertVariant = "default";
      accountStatusMessage = `مهلت استفاده ${normalUserTrialDays} روزه شما تا تاریخ ${premiumExpiryDate.toLocaleDateString(
        "fa-IR",
        { year: "numeric", month: "long", day: "numeric" }
      )} فعال است.`;
    } else {
      alertVariant = "info";
      accountStatusMessage = `شما کاربر عادی هستید. برای شروع استفاده از سرویس‌ها، لطفاً مهلت ${normalUserTrialDays} روزه آزمایشی خود را فعال کنید.`;
    }
  }
  // END: منطق جدید

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="h-full flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-r-transparent animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="p-6">
        {user && !user.isAdmin && accountStatusMessage && (
          <Alert
            variant={alertVariant} // استفاده از variant محاسبه شده
            className="mb-4"
          >
            <Info className="h-4 w-4" />
            <AlertTitle>
              {alertVariant === "destructive"
                ? "مهلت استفاده به پایان رسیده"
                : "وضعیت اشتراک"}
            </AlertTitle>
            <AlertDescription>
              {accountStatusMessage}{" "}
              {isAccountExpired &&
                "برای استفاده مجدد، لطفاً اشتراک خود را ارتقا دهید یا با پشتیبانی تماس بگیرید."}
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle>سرویس‌های شما</CardTitle>
            <CardDescription>
              سرویس‌های فوروارد خود را مدیریت کنید.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list">لیست سرویس‌ها</TabsTrigger>
                <TabsTrigger value="create">ایجاد سرویس جدید</TabsTrigger>
              </TabsList>

              <TabsContent value="list">
                <ForwardingServiceList
                  key={`list-${key}`}
                  onUpdate={handleServiceListOrFormUpdate}
                  userAccountStatus={{
                    isExpired: isAccountExpired,
                    isPremium: user?.isPremium,
                    isAdmin: user?.isAdmin,
                    trialActivated: Boolean(user?.trialActivatedAt),
                    isTelegramConnected: user?.isTelegramConnected,
                    tariffSettings: user?.tariffSettings,
                  }}
                />
              </TabsContent>

              <TabsContent value="create">
                <ForwardingServiceForm
                  onSuccess={handleServiceListOrFormUpdate}
                  userAccountStatus={{
                    isExpired: isAccountExpired,
                    isPremium: user?.isPremium,
                    isAdmin: user?.isAdmin,
                    trialActivated: Boolean(user?.trialActivatedAt),
                    isTelegramConnected: user?.isTelegramConnected,
                    tariffSettings: user?.tariffSettings,
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
