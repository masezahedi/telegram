// app/(dashboard)/dashboard/services/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserService } from '@/lib/services/user-service';
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
      localStorage.setItem("user", JSON.stringify({
        ...userDataResponse.user,
        isTelegramConnected: Boolean(userDataResponse.user.telegram_session), // Use telegram_session
        isAdmin: Boolean(userDataResponse.user.isAdmin),
        isPremium: Boolean(userDataResponse.user.isPremium),
      }));
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

  let accountStatusMessage = "";
  let isAccountExpired = false;
  let alertVariant = "default";

  // Get tariff settings from user object (fetched from API)
  const normalUserTrialDays = user?.tariffSettings?.normalUserTrialDays ?? 15;
  const isTelegramConnected = user?.isTelegramConnected;

  // NEW: Determine the effective expiry date for the user
  const now = new Date();
  let effectiveExpiryDate = null;
  let isTrialActivated = Boolean(user?.trialActivatedAt); // Check if trial was ever activated

  if (user && !user.isAdmin) {
    if (user.isPremium) {
      if (user.premiumExpiryDate) {
        effectiveExpiryDate = new Date(user.premiumExpiryDate);
        accountStatusMessage = `اشتراک پرمیوم شما تا تاریخ ${effectiveExpiryDate.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })} معتبر است.`;
      } else {
        accountStatusMessage = `شما کاربر پرمیوم بدون محدودیت زمانی هستید.`; // Or a specific default if no expiry date
      }
    } else { // Normal user
      if (isTrialActivated) {
        const trialActivatedDate = new Date(user.trialActivatedAt);
        const calculatedTrialExpiry = new Date(trialActivatedDate);
        calculatedTrialExpiry.setDate(trialActivatedDate.getDate() + normalUserTrialDays);
        effectiveExpiryDate = calculatedTrialExpiry;
        accountStatusMessage = `مهلت استفاده ${normalUserTrialDays} روزه شما تا تاریخ ${effectiveExpiryDate.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })} فعال است.`;
      } else {
        accountStatusMessage = `شما کاربر عادی هستید. با فعال‌سازی مهلت ${normalUserTrialDays} روزه، می‌توانید از امکانات سایت استفاده کنید.`;
      }
    }

    // Check if account is expired based on the determined effectiveExpiryDate
    if (effectiveExpiryDate && now >= effectiveExpiryDate) {
        isAccountExpired = true;
        alertVariant = "destructive";
        accountStatusMessage = accountStatusMessage.replace("فعال است.", "منقضی شده است."); // Adjust message for expiry
        accountStatusMessage = accountStatusMessage.replace("معتبر است.", "منقضی شده است."); // Adjust message for expiry
    } else if (!effectiveExpiryDate && !user.isPremium && isTrialActivated) {
        // This case should ideally not happen if trial activation always sets premiumExpiryDate
        // But as a safeguard, if trial was activated but no expiry date, assume expired for now.
        isAccountExpired = true;
        alertVariant = "destructive";
        accountStatusMessage = `مهلت استفاده ${normalUserTrialDays} روزه شما به پایان رسیده است.`;
    } else if (!isTelegramConnected) {
        alertVariant = "warning";
        accountStatusMessage = `برای استفاده از سرویس‌ها، لطفاً ابتدا حساب تلگرام خود را متصل کنید.`;
    } else if (!user.isPremium && !isTrialActivated && isTelegramConnected) {
        // Specific message for normal user, trial not activated, but telegram connected
        alertVariant = "info";
        accountStatusMessage = `شما کاربر عادی هستید. برای شروع استفاده از سرویس‌ها، لطفاً مهلت ${normalUserTrialDays} روزه آزمایشی خود را فعال کنید.`;
    } else {
        alertVariant = "default";
    }
  }


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
        {user &&
          !user.isAdmin &&
          accountStatusMessage && (
            <Alert
              className={`mb-4 ${
                isAccountExpired
                  ? "border-destructive text-destructive [&>svg]:text-destructive"
                  : (alertVariant === "info" ? "border-info text-info [&>svg]:text-info dark:border-blue-700 dark:text-blue-300 dark:[&>svg]:text-blue-400" :
                    (alertVariant === "warning" ? "border-warning text-warning [&>svg]:text-warning dark:border-yellow-700 dark:text-yellow-300 dark:[&>svg]:text-yellow-400" :
                      "border-background text-foreground [&>svg]:text-foreground"
                    )
                  )
              }`}
              variant={alertVariant}
            >
              <Info className="h-4 w-4" />
              <AlertTitle>
                {isAccountExpired ? "مهلت استفاده به پایان رسیده" : "وضعیت اشتراک"}
              </AlertTitle>
              <AlertDescription>
                {accountStatusMessage}{" "}
                {isAccountExpired &&
                  " برای استفاده مجدد، لطفاً اشتراک خود را ارتقا دهید یا با پشتیبانی تماس بگیرید."}
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
                    isExpired: isAccountExpired, // Passed as determined above
                    isPremium: user?.isPremium,
                    isAdmin: user?.isAdmin,
                    trialActivatedAt: user?.trialActivatedAt, // Pass original trial_activated_at
                    premiumExpiryDate: user?.premiumExpiryDate, // Pass original premium_expiry_date
                    isTelegramConnected: user?.isTelegramConnected,
                    tariffSettings: user?.tariffSettings, // Pass tariff settings object
                  }}
                />
              </TabsContent>

              <TabsContent value="create">
                <ForwardingServiceForm
                  onSuccess={handleServiceListOrFormUpdate}
                  userAccountStatus={{
                    isExpired: isAccountExpired, // Passed as determined above
                    isPremium: user?.isPremium,
                    isAdmin: user?.isAdmin,
                    trialActivatedAt: user?.trialActivatedAt, // Pass original trial_activated_at
                    premiumExpiryDate: user?.premiumExpiryDate, // Pass original premium_expiry_date
                    isTelegramConnected: user?.isTelegramConnected,
                    tariffSettings: user?.tariffSettings, // Pass tariff settings object
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