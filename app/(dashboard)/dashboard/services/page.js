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
import { Info, Award } from "lucide-react";
import { Button } from '@/components/ui/button';

export default function Services() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0); // For re-rendering list/form if user status changes

  const fetchUserAndSetState = async () => {
    // Always fetch fresh user data to ensure up-to-date status
    const userDataResponse = await UserService.getCurrentUser();
    if (userDataResponse?.user) {
      // Update localStorage with fresh data, including tariff settings
      // Ensure boolean conversions are handled here for consistency across components
      const updatedUser = {
        ...userDataResponse.user,
        isTelegramConnected: Boolean(userDataResponse.user.telegram_session),
        isAdmin: Boolean(userDataResponse.user.isAdmin), // Already Boolean from API if correct
        isPremium: Boolean(userDataResponse.user.isPremium), // Already Boolean from API if correct
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser); // Directly set the updated user object
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

    // Setup polling interval
    const intervalId = setInterval(fetchUserAndSetState, 60 * 1000); // Poll every 1 minute

    return () => clearInterval(intervalId); // Cleanup on unmount
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

  const now = new Date();
  const userPremiumExpiryDate = user?.premiumExpiryDate ? new Date(user.premiumExpiryDate) : null;
  const isTrialActivated = Boolean(user?.trialActivatedAt); // Ensure boolean conversion

  if (user && !user.isAdmin) {
    if (user.isPremium) {
      if (userPremiumExpiryDate && now >= userPremiumExpiryDate) {
        isAccountExpired = true;
        alertVariant = "destructive";
        accountStatusMessage = `اشتراک پرمیوم شما منقضی شده است.`;
      } else if (userPremiumExpiryDate) {
        accountStatusMessage = `اشتراک پرمیوم شما تا تاریخ ${userPremiumExpiryDate.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })} معتبر است.`;
      } else {
        // This case implies lifetime premium if premium_expiry_date is null for a premium user
        accountStatusMessage = `شما کاربر پرمیوم بدون محدودیت زمانی هستید.`;
      }
    } else { // Not premium
      if (isTrialActivated) {
        // If trial activated, premiumExpiryDate should be set to trial end date
        if (userPremiumExpiryDate && now >= userPremiumExpiryDate) {
          isAccountExpired = true;
          alertVariant = "destructive";
          accountStatusMessage = `مهلت استفاده ${normalUserTrialDays} روزه شما منقضی شده است.`;
        } else if (userPremiumExpiryDate) {
          accountStatusMessage = `مهلت استفاده ${normalUserTrialDays} روزه شما تا تاریخ ${userPremiumExpiryDate.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })} فعال است.`;
        } else {
          // Fallback for unexpected state: trial activated but no expiry date.
          // Treat as expired to be safe.
          isAccountExpired = true;
          alertVariant = "destructive";
          accountStatusMessage = `مهلت استفاده ${normalUserTrialDays} روزه شما فعال شده اما تاریخ انقضا نامشخص است. لطفاً با پشتیبانی تماس بگیرید.`;
        }
      } else {
        // Normal user, trial not activated
        isAccountExpired = true; // For display purposes, it's "expired" because no active period
        alertVariant = "info"; // Use info for "please activate trial"
        accountStatusMessage = `شما کاربر عادی هستید. با فعال‌سازی مهلت ${normalUserTrialDays} روزه، می‌توانید از امکانات سایت استفاده کنید.`;
      }
    }

    // Override messages if Telegram is not connected
    if (!isTelegramConnected) {
      alertVariant = "warning";
      accountStatusMessage = `برای استفاده از سرویس‌ها، لطفاً ابتدا حساب تلگرام خود را متصل کنید.`;
      isAccountExpired = true; // Consider expired for service usage if telegram not connected
    }
  }


  // Logic for showing upgrade button
  const showUpgradeButton =
    user && !user.isAdmin && !user.isPremium && isTelegramConnected && isAccountExpired;

  const handleUpgradeToPremium = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/payment/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          amount: user?.tariffSettings?.premium_price || 100000,
          description: "ارتقاء به حساب کاربری پرمیوم",
          callbackUrl: `${window.location.origin}/dashboard/services?payment_status=success`, // Redirect back to services page
        }),
      });

      const result = await response.json();
      if (result.success && result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        toast.error(result.message || "خطا در شروع پرداخت. لطفاً دوباره تلاش کنید.");
      }
    } catch (error) {
      console.error("Payment initiation error:", error);
      toast.error("خطا در شروع پرداخت. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for payment status in URL on component mount
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    const paymentMessage = urlParams.get('message'); // Added to capture custom message

    if (paymentStatus === 'success') {
      toast.success(paymentMessage || 'پرداخت با موفقیت انجام شد و حساب شما پرمیوم شد!');
      // Clean up URL
      router.replace('/dashboard/services', undefined, { shallow: true });
      fetchUserAndSetState(); // Re-fetch user data to reflect premium status
    } else if (paymentStatus === 'failed') {
      toast.error(paymentMessage || 'پرداخت ناموفق بود. لطفاً دوباره تلاش کنید.');
      // Clean up URL
      router.replace('/dashboard/services', undefined, { shallow: true });
      fetchUserAndSetState(); // Re-fetch user data in case state changed
    }
  }, []); // Run only once on mount


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
                isAccountExpired && alertVariant === "destructive"
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
                {isAccountExpired && alertVariant === "destructive" ? "مهلت استفاده به پایان رسیده" : "وضعیت اشتراک"}
              </AlertTitle>
              <AlertDescription>
                {accountStatusMessage}{" "}
                {isAccountExpired && alertVariant === "destructive" &&
                  " برای استفاده مجدد، لطفاً اشتراک خود را ارتقا دهید یا با پشتیبانی تماس بگیرید."}
              </AlertDescription>
            </Alert>
          )}

        {/* NEW: Upgrade to Premium Button */}
        {showUpgradeButton && (
          <div className="mb-4 text-center">
            <Button
              onClick={handleUpgradeToPremium}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-x-2"
              disabled={loading}
            >
              <Award className="h-5 w-5" />
              {loading ? "در حال انتقال به درگاه..." : `ارتقا به پرمیوم (${(user?.tariffSettings?.premium_price || 0).toLocaleString()} تومان)`}
            </Button>
          </div>
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