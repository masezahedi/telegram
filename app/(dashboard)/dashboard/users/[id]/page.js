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
import { Switch } from "@/components/ui/switch"; // For is_premium toggle
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

  // State for the edit premium dialog
  const [editIsPremium, setEditIsPremium] = useState(false);
  const [editPremiumExpiryDate, setEditPremiumExpiryDate] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const fetchUserData = async () => {
    try {
      const userDetails = await UserService.getUserDetails(params.id);
      setUserData(userDetails);
      if (userDetails) {
        setEditIsPremium(Boolean(userDetails.is_premium));
        setEditPremiumExpiryDate(
          userDetails.premium_expiry_date
            ? new Date(userDetails.premium_expiry_date)
                .toISOString()
                .split("T")[0]
            : ""
        );
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

        const user = AuthService.getStoredUser();
        if (!user?.isAdmin) {
          // Corrected to isAdmin
          router.replace("/dashboard");
          return;
        }
        setCurrentUser(user);
        await fetchUserData();
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
    navigator.clipboard.writeText(text);
    toast.success(message);
  };

  const handlePremiumUpdate = async (e) => {
    e.preventDefault();
    setIsSubmittingPremium(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/admin/users/${params.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_premium: editIsPremium,
          premium_expiry_date: editPremiumExpiryDate
            ? new Date(editPremiumExpiryDate).toISOString()
            : null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("وضعیت پرمیوم کاربر با موفقیت بروزرسانی شد.");
        await fetchUserData(); // Refresh user data
        setIsEditDialogOpen(false); // Close dialog
      } else {
        toast.error(result.error || "خطا در بروزرسانی وضعیت پرمیوم.");
      }
    } catch (error) {
      console.error("Failed to update premium status:", error);
      toast.error("خطای ناشناخته در بروزرسانی وضعیت پرمیوم.");
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
        <div className="p-6 text-center">کاربر یافت نشد.</div>
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
        {/* User Profile */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>پروفایل کاربر</CardTitle>
              <CardDescription>اطلاعات کامل پروفایل کاربر</CardDescription>
            </div>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit3 className="ml-2 h-4 w-4" /> ویرایش وضعیت پرمیوم
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>ویرایش وضعیت پرمیوم</DialogTitle>
                  <DialogDescription>
                    وضعیت پرمیوم و تاریخ انقضای کاربر «{userData.name}» را تغییر
                    دهید.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handlePremiumUpdate} className="space-y-4 py-4">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Switch
                      id="is_premium_edit"
                      checked={editIsPremium}
                      onCheckedChange={setEditIsPremium}
                    />
                    <Label htmlFor="is_premium_edit">کاربر پرمیوم است</Label>
                  </div>
                  {editIsPremium && (
                    <div>
                      <Label htmlFor="premium_expiry_date_edit">
                        تاریخ انقضای پرمیوم
                      </Label>
                      <Input
                        id="premium_expiry_date_edit"
                        type="date"
                        value={editPremiumExpiryDate}
                        onChange={(e) =>
                          setEditPremiumExpiryDate(e.target.value)
                        }
                        className="mt-1"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        تاریخ را خالی بگذارید تا تاریخ انقضا حذف شود.
                      </p>
                    </div>
                  )}
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
                <Label>نام و نام خانوادگی</Label>
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
                <Label>وضعیت اتصال تلگرام</Label>
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
                <Label>وضعیت پرمیوم</Label>
                <Input
                  value={userData.is_premium ? "پرمیوم" : "عادی"}
                  className={userData.is_premium ? "text-success" : ""}
                  readOnly
                />
              </div>
              <div>
                <Label>تاریخ انقضای پرمیوم</Label>
                <Input value={formattedPremiumExpiry} readOnly />
              </div>
              <div>
                <Label>تعداد سرویس ایجاد شده (عمر)</Label>
                <Input
                  value={
                    userData.service_creation_count !== undefined
                      ? userData.service_creation_count
                      : "-"
                  }
                  readOnly
                />
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div>
                <Label>کلید API جیمنای</Label>
                <div className="flex gap-2">
                  <Input value={userData.gemini_api_key || "-"} readOnly />
                  {userData.gemini_api_key && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(
                          userData.gemini_api_key,
                          "کلید API کپی شد"
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label>سشن تلگرام</Label>
                <div className="flex gap-2">
                  <Input value={userData.telegram_session || "-"} readOnly />
                  {userData.telegram_session && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(
                          userData.telegram_session,
                          "سشن تلگرام کپی شد"
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
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
            {userData.services?.length > 0 ? (
              <div className="space-y-4">
                {userData.services.map((service) => (
                  <Card key={service.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold">
                            {service.name}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              service.is_active
                                ? "bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-400"
                                : "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-400"
                            }`}
                          >
                            {service.is_active ? "فعال" : "غیرفعال"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          نوع سرویس:{" "}
                          {service.type === "copy"
                            ? "کپی کانال"
                            : "فوروارد خودکار"}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              کانال‌های مبدا
                            </Label>
                            <div className="mt-1 text-sm">
                              {service.source_channels.join(", ")}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              کانال‌های مقصد
                            </Label>
                            <div className="mt-1 text-sm">
                              {service.target_channels.join(", ")}
                            </div>
                          </div>
                        </div>
                        {service.prompt_template && (
                          <div className="mt-2">
                            <Label className="text-xs text-muted-foreground">
                              قالب پرامپت هوش مصنوعی
                            </Label>
                            <div className="mt-1 p-2 bg-muted rounded-md text-sm whitespace-pre-wrap">
                              {service.prompt_template}
                            </div>
                          </div>
                        )}
                        {service.type === "copy" && (
                          <>
                            <div className="text-sm text-muted-foreground">
                              کپی تاریخچه:{" "}
                              {service.copy_history ? "فعال" : "غیرفعال"}
                            </div>
                            {service.copy_history && (
                              <>
                                <div className="text-sm text-muted-foreground">
                                  محدودیت کپی: {service.history_limit} پیام
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  ترتیب انتخاب پیام ها برای کپی:{" "}
                                  {service.history_direction === "newest"
                                    ? "جدیدترین ها"
                                    : "قدیمی ترین ها"}
                                </div>
                                {service.start_from_id && (
                                  <>
                                    <div className="text-sm text-muted-foreground">
                                      شروع کپی از شناسه پیام:{" "}
                                      {service.start_from_id}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      جهت کپی نسبت به پیام مرجع:{" "}
                                      {service.copy_direction === "before"
                                        ? "پیام های قبل (قدیمی تر)"
                                        : "پیام های بعد (جدیدتر)"}
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                          </>
                        )}
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
