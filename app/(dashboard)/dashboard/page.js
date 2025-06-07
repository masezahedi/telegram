// app/(dashboard)/dashboard/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserService } from "@/lib/services/user-service";
import { AuthService } from "@/lib/services/auth-service";
import { TariffService } from "@/lib/services/tariff-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import TelegramConnection from "@/components/dashboard/telegram-connection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import UpgradeButton from "@/components/dashboard/UpgradeButton"; // کامپوننت جدید
import { AlertTriangle } from "lucide-react";
import { isAfter } from "date-fns";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeAlert, setShowUpgradeAlert] = useState(false);
  const [premiumTariffId, setPremiumTariffId] = useState(null);

  const fetchUserData = async () => {
    try {
      const userDataResponse = await UserService.getCurrentUser();
      if (userDataResponse?.user) {
        const fetchedUser = userDataResponse.user;
        // Update localStorage
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...fetchedUser,
            isTelegramConnected: Boolean(fetchedUser.telegram_session),
            isAdmin: Boolean(fetchedUser.isAdmin),
            isPremium: Boolean(fetchedUser.isPremium),
          })
        );
        const storedUser = AuthService.getStoredUser();
        setUser(storedUser);

        // Check for trial expiry
        if (
          storedUser &&
          !storedUser.isAdmin &&
          !storedUser.isPremium &&
          storedUser.premiumExpiryDate
        ) {
          if (isAfter(new Date(), new Date(storedUser.premiumExpiryDate))) {
            setShowUpgradeAlert(true);
            const tariffs = await TariffService.getTariffSettings(); // Assuming this can get all tariffs now
            if (tariffs && tariffs.premiumUserDefaultDays) {
              // A placeholder check
              // This part needs adjustment if you have multiple tariffs; for now we assume one premium tariff
              // A better approach would be to fetch a specific "premium" tariff by name or flag
              // For now, we'll hardcode a placeholder ID, assuming premium tariff has id=2
              setPremiumTariffId(2);
            }
          }
        }
      } else {
        router.replace("/login");
      }
    } catch (error) {
      console.error("Error loading dashboard user data:", error);
      toast.error("خطا در بارگذاری اطلاعات");
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [router]);

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    fetchUserData(); // Re-fetch all data to ensure status is up to date
  };

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
      <div className="p-6 space-y-4">
        {showUpgradeAlert && premiumTariffId && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>اشتراک آزمایشی شما به پایان رسیده است!</AlertTitle>
            <AlertDescription className="flex justify-between items-center">
              <span>
                برای استفاده نامحدود از سرویس‌ها، حساب خود را به پرمیوم ارتقا
                دهید.
              </span>
              <UpgradeButton tariffId={premiumTariffId}>
                ارتقا به پرمیوم
              </UpgradeButton>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>اتصال به تلگرام</CardTitle>
            <CardDescription>
              برای استفاده از سرویس‌های تلگرام، حساب خود را متصل کنید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TelegramConnection user={user} onUserUpdate={handleUserUpdate} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
