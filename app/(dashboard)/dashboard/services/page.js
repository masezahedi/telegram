"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserService } from '@/lib/services/user-service'; // Make sure UserService is imported
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
    const storedUser = AuthService.getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    } else {
      // Fallback or if localStorage is cleared/stale
      const freshUser = await UserService.getCurrentUser(); // Assuming UserService exists and fetches fresh data
      if (freshUser) {
        // Update local storage with fresh data, including tariff settings
        const { user: freshUserData } = freshUser; // getCurrentUser returns { user: ... }
        localStorage.setItem("user", JSON.stringify({
          ...freshUserData,
          isTelegramConnected: Boolean(freshUserData.telegramSession),
          isAdmin: Boolean(freshUserData.isAdmin),
          isPremium: Boolean(freshUserData.isPremium),
        }));
        setUser(freshUserData);
      } else {
        toast.error("خطا در دریافت اطلاعات کاربر.");
        router.replace("/login");
      }
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
  let accountExpiryDateFormatted = "";
  let isAccountExpired = false;
  let alertVariant = "default";
  
  // Extract tariff settings from user object
  const normalUserTrialDays = user?.tariffSettings?.normalUserTrialDays ?? 15;
  const premiumUserDefaultDays = user?.tariffSettings?.premiumUserDefaultDays ?? 30;


  if (user && !user.isAdmin) {
    const now = new Date();
    if (user.isPremium) {
      if (user.premiumExpiryDate) {
        const expiry = new Date(user.premiumExpiryDate);
        accountExpiryDateFormatted = expiry.toLocaleDateString("fa-IR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        if (now >= expiry) {
          accountStatusMessage = `اشتراک پرمیوم شما در تاریخ ${accountExpiryDateFormatted} منقضی شده است.`;
          isAccountExpired = true;
          alertVariant = "destructive";
        } else {
          accountStatusMessage = `اشتراک پرمیوم شما تا تاریخ ${accountExpiryDateFormatted} معتبر است.`;
          alertVariant = "default";
        }
      } else {
        accountStatusMessage = `شما کاربر پرمیوم بدون محدودیت زمانی هستید.`;
        alertVariant = "default";
      }
    } else {
      // Normal user
      if (user.trialActivatedAt) {
        const trialActivatedDate = new Date(user.trialActivatedAt);
        const trialExpiry = new Date(trialActivatedDate);
        trialExpiry.setDate(trialActivatedDate.getDate() + normalUserTrialDays); // Use dynamic trial days
        
        accountExpiryDateFormatted = trialExpiry.toLocaleDateString("fa-IR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        
        if (now >= trialExpiry) {
          accountStatusMessage = `مهلت استفاده ${normalUserTrialDays} روزه شما در تاریخ ${accountExpiryDateFormatted} به پایان رسیده است.`;
          isAccountExpired = true;
          alertVariant = "destructive";
        } else {
          accountStatusMessage = `مهلت استفاده ${normalUserTrialDays} روزه شما تا تاریخ ${accountExpiryDateFormatted} فعال است.`;
          alertVariant = "default";
        }
      } else {
        accountStatusMessage =
          `شما کاربر عادی هستید. با فعال‌سازی اولین سرویس، مهلت ${normalUserTrialDays} روزه شما آغاز می‌شود.`;
        alertVariant = "default";
      }
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
                  : "border-info text-info [&>svg]:text-info dark:border-blue-700 dark:text-blue-300 dark:[&>svg]:text-blue-400"
              }`}
              variant={alertVariant}
            >
              <Info className="h-4 w-4" />
              <AlertTitle>
                {isAccountExpired
                  ? "مهلت استفاده به پایان رسیده"
                  : "وضعیت اشتراک"}
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
                    isExpired: isAccountExpired,
                    isPremium: user?.isPremium,
                    isAdmin: user?.isAdmin,
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
                    // Pass tariff settings to form for client-side validation messages if needed
                    normalUserMaxChannelsPerService: user?.tariffSettings?.normalUserMaxChannelsPerService,
                    premiumUserMaxChannelsPerService: user?.tariffSettings?.premiumUserMaxChannelsPerService,
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