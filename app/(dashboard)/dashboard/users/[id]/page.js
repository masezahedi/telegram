// app/(dashboard)/dashboard/users/[id]/page.js (نسخه کامل و اصلاح شده)
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthService } from "@/lib/services/auth-service";
import { UserService } from "@/lib/services/user-service";
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
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import { Copy, Edit3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

export default function UserDetails({ params }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isSubmittingPremium, setIsSubmittingPremium] = useState(false);
  const [editIsPremium, setEditIsPremium] = useState(false);
  const [editPremiumExpiryDate, setEditPremiumExpiryDate] = useState("");
  const [isPremiumEditDialogOpen, setIsPremiumEditDialogOpen] = useState(false);

  const fetchSpecificUserData = async () => {
    try {
      const userDetails = await UserService.getUserDetails(params.id);
      if (userDetails?.user) {
        setUserData({
          ...userDetails.user,
          services: (userDetails.user.services || []).map((service) => ({
            ...service,
            source_channels: Array.isArray(service.source_channels)
              ? service.source_channels
              : JSON.parse(service.source_channels || "[]"),
            target_channels: Array.isArray(service.target_channels)
              ? service.target_channels
              : JSON.parse(service.target_channels || "[]"),
            search_replace_rules: Array.isArray(service.search_replace_rules)
              ? service.search_replace_rules
              : JSON.parse(service.search_replace_rules || "[]"),
          })),
        });
        setEditIsPremium(Boolean(userDetails.user.is_premium));
        setEditPremiumExpiryDate(
          userDetails.user.premium_expiry_date
            ? new Date(userDetails.user.premium_expiry_date)
                .toISOString()
                .split("T")[0]
            : ""
        );
      } else {
        toast.error("کاربر مورد نظر یافت نشد.");
      }
    } catch (error) {
      console.error("Error loading user details:", error);
      toast.error("خطا در بارگذاری اطلاعات کاربر");
    }
  };

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
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
        await fetchSpecificUserData();
      } catch (error) {
        console.error("Auth or data loading error:", error);
        toast.error("خطا در بارگذاری صفحه");
      } finally {
        setLoading(false);
      }
    };
    checkAuthAndLoadData();
  }, [router, params.id]);

  const copyToClipboard = (text, message) => {
    if (text && typeof text === "string") {
      navigator.clipboard.writeText(text);
      toast.success(message);
    } else {
      toast.error("مقداری برای کپی وجود ندارد.");
    }
  };

  const handleUserAccountUpdate = async (e) => {
    e.preventDefault();
    setIsSubmittingPremium(true);
    try {
      const token = localStorage.getItem("auth_token");
      const payload = {
        is_premium: editIsPremium,
        premium_expiry_date: editPremiumExpiryDate
          ? new Date(editPremiumExpiryDate).toISOString()
          : null,
      };

      const response = await fetch(`/api/admin/users/${params.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("اطلاعات حساب کاربری با موفقیت بروزرسانی شد.");
        await fetchSpecificUserData();
        setIsPremiumEditDialogOpen(false);
      } else {
        toast.error(result.error || "خطا در بروزرسانی اطلاعات حساب کاربری.");
      }
    } catch (error) {
      console.error("Failed to update user account info:", error);
      toast.error("خطای ناشناخته در بروزرسانی اطلاعات حساب کاربری.");
    } finally {
      setIsSubmittingPremium(false);
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
  if (!userData) {
    return (
      <DashboardLayout user={currentUser}>
        <div className="p-6 text-center">
          <p>اطلاعات کاربر در حال بارگذاری است یا کاربر یافت نشد.</p>
          <Button
            onClick={() => router.push("/dashboard/users")}
            variant="outline"
            className="mt-4"
          >
            بازگشت به لیست کاربران
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const formattedPremiumExpiry = userData.premium_expiry_date
    ? new Date(userData.premium_expiry_date).toLocaleDateString("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  return (
    <DashboardLayout user={currentUser}>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>پروفایل و وضعیت اشتراک کاربر</CardTitle>
              <CardDescription>اطلاعات و وضعیت اشتراک کاربر</CardDescription>
            </div>
            <Dialog
              open={isPremiumEditDialogOpen}
              onOpenChange={setIsPremiumEditDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit3 className="ml-2 h-4 w-4" /> ویرایش وضعیت اشتراک
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>ویرایش وضعیت اشتراک</DialogTitle>
                  <DialogDescription>
                    وضعیت پرمیوم و تاریخ انقضا کاربر «{userData.name}» را تغییر
                    دهید.
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={handleUserAccountUpdate}
                  className="space-y-4 py-4"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Switch
                      id="is_premium_edit"
                      checked={editIsPremium}
                      onCheckedChange={setEditIsPremium}
                    />
                    <Label htmlFor="is_premium_edit">کاربر پرمیوم است</Label>
                  </div>
                  <div>
                    <Label htmlFor="premium_expiry_date_edit">
                      تاریخ انقضای حساب (پرمیوم/عادی)
                    </Label>
                    <Input
                      id="premium_expiry_date_edit"
                      type="date"
                      value={editPremiumExpiryDate}
                      onChange={(e) => setEditPremiumExpiryDate(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      این تاریخ هم برای پرمیوم و هم برای مهلت عادی کاربرد دارد.
                    </p>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        لغو
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmittingPremium}>
                      {isSubmittingPremium
                        ? "در حال ذخیره..."
                        : "ذخیره تغییرات"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>نام</Label>
                <Input value={userData.name || "-"} readOnly />
              </div>
              <div>
                <Label>ایمیل</Label>
                <Input value={userData.email || "-"} readOnly />
              </div>
              <div>
                <Label>شماره تلفن</Label>
                <Input value={userData.phone_number || "-"} readOnly />
              </div>
              <div>
                <Label>اتصال تلگرام</Label>
                <Input
                  value={userData.telegram_session ? "متصل" : "غیر متصل"}
                  className={
                    userData.telegram_session
                      ? "text-success"
                      : "text-destructive"
                  }
                  readOnly
                />
              </div>
              <div>
                <Label>وضعیت کاربر</Label>
                <Input
                  value={userData.is_premium ? "پرمیوم" : "عادی"}
                  className={userData.is_premium ? "text-success" : ""}
                  readOnly
                />
              </div>
              <div>
                <Label>تاریخ انقضای حساب</Label>
                <Input value={formattedPremiumExpiry} readOnly />
              </div>
              {/* START: Added Fields */}
              <div>
                <Label>مهلت آزمایشی استفاده شده</Label>
                <Input
                  value={userData.trial_activated_at ? "بله" : "خیر"}
                  className={userData.trial_activated_at ? "text-success" : ""}
                  readOnly
                />
              </div>
              <div>
                <Label>تعداد کل سرویس‌های ایجاد شده</Label>
                <Input value={userData.service_creation_count ?? 0} readOnly />
              </div>
              {/* END: Added Fields */}
            </div>
            {/* Other details like API key and session can remain */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>سرویس‌های کاربر</CardTitle>
            <CardDescription>
              لیست تمامی سرویس‌های تعریف شده توسط کاربر
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userData.services && userData.services.length > 0 ? (
              <div className="space-y-4">
                {userData.services.map((service) => (
                  <Card key={service.id}>
                    <CardHeader>
                      <h3 className="text-lg font-semibold flex justify-between items-center">
                        <span>{service.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            service.is_active
                              ? "bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-400"
                          }`}
                        >
                          {service.is_active ? "فعال" : "غیرفعال"}
                        </span>
                      </h3>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          نوع:{" "}
                          {service.type === "copy"
                            ? "کپی کانال"
                            : "فوروارد خودکار"}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 mt-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              مبدا:
                            </Label>
                            <div className="text-sm">
                              {service.source_channels.join(", ")}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              مقصد:
                            </Label>
                            <div className="text-sm">
                              {service.target_channels.join(", ")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                هیچ سرویسی برای این کاربر یافت نشد.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
