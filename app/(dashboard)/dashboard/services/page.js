"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
        setUser(freshUser);
        // Optionally update localStorage here if needed, though login should be the source of truth
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
  let isAccountExpired = false; // Renamed from isExpired for clarity
  let alertVariant = "default";

  if (user && !user.isAdmin) {
    // Only show status for non-admin users
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
          alertVariant = "default"; // Or a success/info variant
        }
      } else {
        accountStatusMessage = `شما کاربر پرمیوم بدون محدودیت زمانی هستید.`;
        alertVariant = "default";
      }
    } else {
      // Normal user
      if (user.trialActivatedAt && user.premiumExpiryDate) {
        // premiumExpiryDate is the trial end date here
        const expiry = new Date(user.premiumExpiryDate);
        accountExpiryDateFormatted = expiry.toLocaleDateString("fa-IR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        if (now >= expiry) {
          accountStatusMessage = `مهلت استفاده ۱۵ روزه شما در تاریخ ${accountExpiryDateFormatted} به پایان رسیده است.`;
          isAccountExpired = true;
          alertVariant = "destructive";
        } else {
          accountStatusMessage = `مهلت استفاده ۱۵ روزه شما تا تاریخ ${accountExpiryDateFormatted} فعال است.`;
          alertVariant = "default";
        }
      } else if (user.trialActivatedAt && !user.premiumExpiryDate) {
        accountStatusMessage =
          "خطا در محاسبه مهلت استفاده. لطفاً با پشتیبانی تماس بگیرید.";
        isAccountExpired = true; // Treat as expired to be safe
        alertVariant = "destructive";
      } else {
        accountStatusMessage =
          "شما کاربر عادی هستید. با فعال‌سازی اولین سرویس، مهلت ۱۵ روزه شما آغاز می‌شود.";
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
          accountStatusMessage && ( // Only show for non-admins
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
