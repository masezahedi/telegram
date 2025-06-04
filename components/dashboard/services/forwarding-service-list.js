// components/dashboard/services/forwarding-service-list.js
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Info, MessageCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ForwardingService } from "@/lib/services/forwarding-service";
import ForwardingServiceForm from "./forwarding-service-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserService } from "@/lib/services/user-service";

export default function ForwardingServiceList({ onUpdate, userAccountStatus }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Extract tariff settings and user status
  const normalUserTrialDays = userAccountStatus?.tariffSettings?.normalUserTrialDays ?? 15;
  const normalUserMaxActiveServices = userAccountStatus?.tariffSettings?.normalUserMaxActiveServices ?? 1;
  const premiumUserMaxActiveServices = userAccountStatus?.tariffSettings?.premiumUserMaxActiveServices ?? 5;

  const isTelegramConnected = userAccountStatus?.isTelegramConnected;
  const isAdmin = userAccountStatus?.isAdmin;
  const isPremium = userAccountStatus?.isPremium;
  const trialActivated = userAccountStatus?.trialActivatedAt; // Use `trialActivatedAt` to check if trial was ever activated

  // Determine if the user's account is currently expired based on premium_expiry_date
  const now = new Date();
  const isAccountExpired = userAccountStatus?.premiumExpiryDate
    ? (new Date(userAccountStatus.premiumExpiryDate) < now)
    : (!isPremium && trialActivated && (!userAccountStatus.premiumExpiryDate || new Date(userAccountStatus.premiumExpiryDate) < now)); // If trial activated but no expiry date or expired, treat as expired

  const loadServices = async () => {
    setLoading(true);
    try {
      const data = await ForwardingService.getServices();
      setServices(data);
    } catch (error) {
      console.error("Load services error:", error);
      toast.error("خطا در بارگذاری سرویس‌ها");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleStatusChange = async (id, newIsActiveStatus) => {
    // Check if activating or deactivating
    if (newIsActiveStatus) { // User is trying to ACTIVATE a service
      if (!isTelegramConnected) {
        toast.error("لطفاً ابتدا حساب تلگرام خود را متصل کنید.");
        await loadServices(); // Reload to revert UI if toast prevents action
        return;
      }
      if (!isAdmin) { // Admins bypass these checks
        if (isAccountExpired) {
          toast.error(
            "مهلت استفاده شما از سرویس‌ها به پایان رسیده است. امکان فعال‌سازی سرویس وجود ندارد. لطفاً اشتراک خود را ارتقا دهید."
          );
          await loadServices();
          return;
        }
        if (!isPremium && !trialActivated) { // If normal user AND trial NOT activated yet
          toast.error(
            `لطفاً برای شروع استفاده از سرویس، روی دکمه "فعال‌سازی مهلت ${normalUserTrialDays} روزه" کلیک کنید.`
          );
          await loadServices();
          return;
        }
      }
    }

    // Check active service limit if activating
    if (newIsActiveStatus && !isAdmin) {
      const currentActiveServices = services.filter(s => s.is_active).length;
      const maxActiveServices = isPremium
        ? premiumUserMaxActiveServices
        : normalUserMaxActiveServices;

      if (currentActiveServices >= maxActiveServices) {
        toast.error(
          `شما به حداکثر تعداد سرویس‌های فعال (${maxActiveServices}) رسیده‌اید. برای فعال‌سازی این سرویس، لطفاً ابتدا یک سرویس دیگر را غیرفعال کنید.`
        );
        await loadServices();
        return;
      }
    }

    try {
      const result = await ForwardingService.updateServiceStatus(
        id,
        newIsActiveStatus
      );
      if (result.success) {
        await loadServices();
        toast.success(
          newIsActiveStatus
            ? "سرویس با موفقیت فعال شد"
            : "سرویس با موفقیت غیرفعال شد"
        );
        onUpdate?.(); // Trigger parent update to refresh user status/expiry message
      } else {
        toast.error(result.error || "خطا در تغییر وضعیت سرویس");
        await loadServices();
      }
    } catch (error) {
      console.error("Update service status error:", error);
      toast.error("خطا در تغییر وضعیت سرویس");
      await loadServices();
    }
  };

  const handleDelete = async (id) => {
    if (
      !confirm(
        "آیا از حذف این سرویس اطمینان دارید؟ این عمل غیرقابل بازگشت است."
      )
    )
      return;
    try {
      const result = await ForwardingService.deleteService(id);
      if (result.success) {
        setServices(services.filter((service) => service.id !== id));
        toast.success("سرویس با موفقیت حذف شد");
        onUpdate?.(); // Trigger parent update
      } else {
        toast.error(result.error || "خطا در حذف سرویس");
      }
    } catch (error) {
      console.error("Delete service error:", error);
      toast.error("خطا در حذف سرویس");
    }
  };

  const handleEdit = (service) => {
    // Block editing if account is expired and not premium/admin or telegram not connected
    if (!isAdmin) {
      if (isAccountExpired) {
        toast.error(
          "مهلت استفاده شما به پایان رسیده و امکان ویرایش سرویس وجود ندارد. لطفاً اشتراک خود را ارتقا دهید."
        );
        return;
      }
      if (!isPremium && !trialActivated) { // If normal user AND trial NOT activated yet
        toast.error(
          `لطفاً برای شروع استفاده از سرویس، روی دکمه "فعال‌سازی مهلت ${normalUserTrialDays} روزه" کلیک کنید.`
        );
        return;
      }
      if (!isTelegramConnected) {
        toast.error("لطفاً ابتدا حساب تلگرام خود را متصل کنید.");
        return;
      }
    }

    setEditingService(service);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setEditingService(null);
    setShowForm(false);
    loadServices();
    onUpdate?.();
  };

  // NEW LOGIC: Handle trial activation
  const handleActivateTrial = async () => {
    setLoading(true);
    try {
      const result = await UserService.activateTrial();
      if (result.success) {
        toast.success(result.message);
        onUpdate?.(); // Trigger user state update in parent
      } else {
        toast.error(result.error || "خطا در فعال‌سازی مهلت آزمایشی.");
      }
    } catch (error) {
      console.error("Error activating trial:", error);
      toast.error("خطا در فعال‌سازی مهلت آزمایشی.");
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-r-transparent animate-spin"></div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {editingService ? "ویرایش سرویس" : "ایجاد سرویس جدید"}
          </h2>
          <Button
            variant="outline"
            onClick={() => {
              setShowForm(false);
              setEditingService(null);
            }}
          >
            بازگشت به لیست
          </Button>
        </div>
        <ForwardingServiceForm
          service={editingService}
          onSuccess={handleFormSuccess}
          userAccountStatus={userAccountStatus}
        />
      </div>
    );
  }

  // Determine if "Create New Service" button should be disabled
  const disableCreateNew =
    !isAdmin && // Not an admin
    (
      isAccountExpired || // Account is expired
      !trialActivated || // Trial not activated yet
      !isTelegramConnected // Not telegram connected
    );

  // Determine if trial activation button should be shown
  const showTrialActivationButton =
    !isAdmin &&
    !isPremium &&
    !trialActivated && // Only show if normal user and trial hasn't started
    isTelegramConnected && // Only show if telegram is connected
    !isAccountExpired; // Only show if account is not already expired

  // Determine if switch should be disabled for limit reasons or general account status
  const disableSwitchDueToLimits = (serviceStatus) => {
    if (isAdmin) return false; // Admins always enabled

    if (!isTelegramConnected) return true; // Disable if Telegram is not connected
    if (isAccountExpired) return true; // Disable if account is expired
    if (!isPremium && !trialActivated) return true; // Disable if normal user and trial not activated

    if (!serviceStatus.is_active) { // If trying to activate an inactive service
      const currentActiveServices = services.filter(s => s.is_active).length;
      const maxActiveServices = isPremium
        ? premiumUserMaxActiveServices
        : normalUserMaxActiveServices;

      if (currentActiveServices >= maxActiveServices) {
        return true; // Disable if max active services reached
      }
    }
    return false;
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
        <div className="flex justify-end gap-x-2">
          {showTrialActivationButton && (
            <Button
              onClick={handleActivateTrial}
              className="bg-info hover:bg-info/90 text-info-foreground gap-x-2"
              disabled={loading}
            >
              <Info className="h-4 w-4" />
              {loading ? "در حال فعال‌سازی..." : `فعال‌سازی مهلت ${normalUserTrialDays} روزه`}
            </Button>
          )}
          <Button
            onClick={() => setShowForm(true)}
            className="gap-x-2"
            disabled={disableCreateNew}
          >
            <Plus className="h-4 w-4" />
            ایجاد سرویس جدید
          </Button>
        </div>

        {disableCreateNew && (
          <Alert variant="destructive" className="mt-2">
            <Info className="h-4 w-4" />
            <AlertTitle>محدودیت ایجاد سرویس</AlertTitle>
            <AlertDescription>
              امکان ایجاد سرویس جدید وجود ندارد. لطفاً{" "}
              {!isTelegramConnected ? "ابتدا تلگرام خود را متصل کنید،" : ""}
              {(!isPremium && !trialActivated) ? " مهلت آزمایشی خود را فعال کنید" : ""}
              {(isAccountExpired) ? " یا اشتراک خود را ارتقا دهید." : ""}
            </AlertDescription>
          </Alert>
        )}

        {services.length === 0 && !loading ? (
          <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg mt-4">
            <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="font-semibold">هیچ سرویسی یافت نشد.</p>
            <p className="text-sm">برای شروع، یک سرویس جدید ایجاد کنید.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-full">
              <TableCaption className="py-4 text-center">
                لیست سرویس‌های فوروارد و کپی شما.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-[200px] ps-4">
                    نام سرویس
                  </TableHead>
                  <TableHead className="text-right w-[150px]">
                    نوع سرویس
                  </TableHead>
                  <TableHead className="text-right">کانال‌های مبدا</TableHead>
                  <TableHead className="text-right">کانال‌های مقصد</TableHead>
                  <TableHead className="text-right w-[100px]">وضعیت</TableHead>
                  <TableHead className="text-center w-[120px] pe-4">
                    عملیات
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id} className="hover:bg-muted/50">
                    <TableCell className="text-right font-medium py-3 ps-4">
                      {service.name}
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <Badge
                        variant={
                          service.type === "copy" ? "secondary" : "default"
                        }
                        className="whitespace-nowrap"
                      >
                        {service.type === "copy"
                          ? "کپی کانال"
                          : "فوروارد خودکار"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-3 max-w-xs truncate">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">
                            {(Array.isArray(service.source_channels)
                              ? service.source_channels
                              : []
                            ).join("، ")}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="text-right">
                          {" "}
                          {(Array.isArray(service.source_channels)
                            ? service.source_channels
                            : []
                          ).map((ch) => (
                            <div key={ch}>{ch}</div>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right py-3 max-w-xs truncate">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">
                            {(Array.isArray(service.target_channels)
                              ? service.target_channels
                              : []
                            ).join("، ")}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="text-right">
                          {(Array.isArray(service.target_channels)
                            ? service.target_channels
                            : []
                          ).map((ch) => (
                            <div key={ch}>{ch}</div>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <Switch
                        checked={Boolean(service.is_active)}
                        onCheckedChange={(checked) =>
                          handleStatusChange(service.id, checked)
                        }
                        disabled={disableSwitchDueToLimits(service)}
                        aria-label={`فعال/غیرفعال سازی سرویس ${service.name}`}
                        dir="ltr"
                      />
                    </TableCell>
                    <TableCell className="text-center py-3 pe-4">
                      <div className="flex justify-center gap-x-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(service)}
                              disabled={!isAdmin && (isAccountExpired || !trialActivated || !isTelegramConnected)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">ویرایش</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>ویرایش سرویس</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive/90"
                              onClick={() => handleDelete(service.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">حذف</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>حذف سرویس</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}