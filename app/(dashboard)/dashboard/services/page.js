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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; // Added Alert
import { Info } from "lucide-react";

export default function Services() {
  const router = useRouter();
  const [user, setUser] = useState(null); // Logged-in user
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0); // For re-rendering list

  useEffect(() => {
    const checkAuthAndLoadUser = async () => {
      try {
        const isAuthenticated = await AuthService.isAuthenticated();
        if (!isAuthenticated) {
          router.replace("/login");
          return;
        }
        const storedUser = AuthService.getStoredUser();
        setUser(storedUser); // Set user from localStorage
      } catch (error) {
        console.error("Error loading services page:", error);
        toast.error("خطا در بارگذاری سرویس‌ها");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadUser();
  }, [router]);

  const handleServiceCreatedOrUpdated = () => {
    // Renamed for clarity
    setKey((prev) => prev + 1); // Re-render the list
    // Optionally re-fetch user data if account expiry might have changed
    const updatedStoredUser = AuthService.getStoredUser();
    setUser(updatedStoredUser);
  };

  let accountStatusMessage = "";
  let accountExpiryDateFormatted = "";
  let isExpired = false;

  if (user) {
    const now = new Date();
    if (user.isPremium && user.premiumExpiryDate) {
      const expiry = new Date(user.premiumExpiryDate);
      accountExpiryDateFormatted = expiry.toLocaleDateString("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (now >= expiry) {
        accountStatusMessage = `اشتراک پرمیوم شما در تاریخ ${accountExpiryDateFormatted} منقضی شده است.`;
        isExpired = true;
      } else {
        accountStatusMessage = `اشتراک پرمیوم شما تا تاریخ ${accountExpiryDateFormatted} معتبر است.`;
      }
    } else if (!user.isPremium && user.trialActivatedAt) {
      const trialEnd = new Date(user.trialActivatedAt);
      trialEnd.setDate(trialEnd.getDate() + 15);
      accountExpiryDateFormatted = trialEnd.toLocaleDateString("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (now >= trialEnd) {
        accountStatusMessage = `مهلت استفاده ۱۵ روزه شما در تاریخ ${accountExpiryDateFormatted} به پایان رسیده است.`;
        isExpired = true;
      } else {
        accountStatusMessage = `مهلت استفاده ۱۵ روزه شما تا تاریخ ${accountExpiryDateFormatted} فعال است.`;
      }
    } else if (!user.isPremium && !user.trialActivatedAt) {
      accountStatusMessage =
        "شما کاربر عادی هستید. با فعال‌سازی اولین سرویس، مهلت ۱۵ روزه شما آغاز می‌شود.";
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
        {user && accountStatusMessage && (
          <Alert
            className={`mb-4 ${
              isExpired
                ? "border-destructive text-destructive [&>svg]:text-destructive"
                : "border-info text-info [&>svg]:text-info"
            }`}
            variant={isExpired ? "destructive" : "default"}
          >
            <Info className="h-4 w-4" />
            <AlertTitle>
              {isExpired ? "مهلت استفاده به پایان رسیده" : "وضعیت اشتراک"}
            </AlertTitle>
            <AlertDescription>
              {accountStatusMessage}{" "}
              {isExpired && " برای استفاده مجدد، اشتراک خود را ارتقا دهید."}
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
                  onUpdate={handleServiceCreatedOrUpdated}
                  userAccountStatus={{
                    isExpired,
                    isPremium: user?.isPremium,
                    trialActivatedAt: user?.trialActivatedAt,
                  }}
                />
              </TabsContent>

              <TabsContent value="create">
                <ForwardingServiceForm
                  onSuccess={handleServiceCreatedOrUpdated}
                  userAccountStatus={{
                    isExpired,
                    isPremium: user?.isPremium,
                    trialActivatedAt: user?.trialActivatedAt,
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
