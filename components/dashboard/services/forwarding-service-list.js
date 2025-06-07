// components/dashboard/services/forwarding-service-list.js (نسخه کامل و اصلاح شده)
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

  // Extract props passed from parent component. These are now the single source of truth.
  const isAccountExpired = userAccountStatus?.isExpired;
  const isTelegramConnected = userAccountStatus?.isTelegramConnected;
  const isAdmin = userAccountStatus?.isAdmin;
  const isPremium = userAccountStatus?.isPremium;
  const isTrialActivated = userAccountStatus?.trialActivated;
  const normalUserTrialDays =
    userAccountStatus?.tariffSettings?.normalUserTrialDays ?? 15;
  const normalUserMaxActiveServices =
    userAccountStatus?.tariffSettings?.normalUserMaxActiveServices ?? 1;
  const premiumUserMaxActiveServices =
    userAccountStatus?.tariffSettings?.premiumUserMaxActiveServices ?? 5;

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
    if (newIsActiveStatus) {
      if (!isTelegramConnected) {
        toast.error("لطفاً ابتدا حساب تلگرام خود را متصل کنید.");
        await loadServices();
        return;
      }
      if (!isAdmin) {
        if (isAccountExpired) {
          toast.error(
            "مهلت استفاده شما از سرویس‌ها به پایان رسیده است. امکان فعال‌سازی سرویس وجود ندارد."
          );
          await loadServices();
          return;
        }
        if (!isPremium && !isTrialActivated) {
          toast.error(
            `لطفاً برای شروع استفاده از سرویس، روی دکمه "فعال‌سازی مهلت ${normalUserTrialDays} روزه" کلیک کنید.`
          );
          await loadServices();
          return;
        }
      }
    }

    if (newIsActiveStatus && !isAdmin) {
      const currentActiveServices = services.filter((s) => s.is_active).length;
      const maxActiveServices = isPremium
        ? premiumUserMaxActiveServices
        : normalUserMaxActiveServices;

      if (currentActiveServices >= maxActiveServices) {
        toast.error(
          `شما به حداکثر تعداد سرویس‌های فعال (${maxActiveServices}) رسیده‌اید.`
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
        onUpdate?.();
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
        onUpdate?.();
      } else {
        toast.error(result.error || "خطا در حذف سرویس");
      }
    } catch (error) {
      console.error("Delete service error:", error);
      toast.error("خطا در حذف سرویس");
    }
  };

  const handleEdit = (service) => {
    if (!isAdmin) {
      if (isAccountExpired) {
        toast.error(
          "مهلت استفاده شما به پایان رسیده و امکان ویرایش سرویس وجود ندارد."
        );
        return;
      }
      if (!isPremium && !isTrialActivated) {
        toast.error(
          `لطفاً برای شروع استفاده از سرویس، مهلت ${normalUserTrialDays} روزه آزمایشی خود را فعال کنید.`
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

  const handleActivateTrial = async () => {
    setLoading(true);
    try {
      const result = await UserService.activateTrial();
      if (result.success) {
        toast.success(result.message);
        onUpdate?.();
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

  // Logic for disabling create button and switches
  const disableCreateNew =
    !isAdmin &&
    (isAccountExpired ||
      !isTelegramConnected ||
      (!isPremium && !isTrialActivated));
  const showTrialActivationButton =
    !isAdmin && !isPremium && !isTrialActivated && isTelegramConnected;

  const getSwitchDisabledTooltip = (service) => {
    if (!isTelegramConnected)
      return "برای فعال‌سازی، ابتدا تلگرام را متصل کنید.";
    if (isAccountExpired) return "حساب کاربری شما منقضی شده است.";
    if (!isPremium && !isTrialActivated)
      return `برای فعال‌سازی، ابتدا مهلت ${normalUserTrialDays} روزه خود را فعال کنید.`;

    if (!service.is_active) {
      const currentActiveServices = services.filter((s) => s.is_active).length;
      const maxActiveServices = isPremium
        ? premiumUserMaxActiveServices
        : normalUserMaxActiveServices;
      if (currentActiveServices >= maxActiveServices) {
        return `به سقف ${maxActiveServices} سرویس فعال رسیده‌اید.`;
      }
    }
    return null; // No tooltip needed if not disabled
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
              {loading
                ? "در حال فعال‌سازی..."
                : `فعال‌سازی مهلت ${normalUserTrialDays} روزه`}
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
              {!isTelegramConnected
                ? "لطفاً ابتدا تلگرام خود را متصل کنید."
                : !isPremium && !isTrialActivated
                ? `لطفاً مهلت آزمایشی خود را فعال کنید.`
                : "مهلت استفاده شما به پایان رسیده است. برای ایجاد سرویس جدید، اشتراک خود را ارتقا دهید."}
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
                {services.map((service) => {
                  const switchDisabled =
                    !isAdmin &&
                    (isAccountExpired ||
                      !isTelegramConnected ||
                      (!isPremium && !isTrialActivated));
                  const switchTooltip = getSwitchDisabledTooltip(service);
                  return (
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
                        {(service.source_channels || []).join("، ")}
                      </TableCell>
                      <TableCell className="text-right py-3 max-w-xs truncate">
                        {(service.target_channels || []).join("، ")}
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              {" "}
                              {/* Wrapper div for TooltipTrigger */}
                              <Switch
                                checked={Boolean(service.is_active)}
                                onCheckedChange={(checked) =>
                                  handleStatusChange(service.id, checked)
                                }
                                disabled={switchDisabled}
                                dir="ltr"
                              />
                            </div>
                          </TooltipTrigger>
                          {switchTooltip && (
                            <TooltipContent>
                              <p>{switchTooltip}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-center py-3 pe-4">
                        <div className="flex justify-center gap-x-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(service)}
                              >
                                <Pencil className="h-4 w-4" />
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
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>حذف سرویس</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
