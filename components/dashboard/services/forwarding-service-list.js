// components/dashboard/services/forwarding-service-list.js (نسخه کامل و اصلاح شده)
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Pencil,
  Trash2,
  Info,
  MessageCircle,
  MoreVertical,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";

export default function ForwardingServiceList({ onUpdate, userAccountStatus }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const {
    isExpired: isAccountExpired,
    isPremium,
    isAdmin,
    trialActivated: isTrialActivated,
    isTelegramConnected,
    tariffSettings,
  } = userAccountStatus || {};

  const normalUserTrialDays = tariffSettings?.normalUserTrialDays ?? 15;
  const normalUserMaxActiveServices =
    tariffSettings?.normalUserMaxActiveServices ?? 1;
  const premiumUserMaxActiveServices =
    tariffSettings?.premiumUserMaxActiveServices ?? 5;

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
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 self-end" />
        <div className="rounded-md border p-4 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-6 w-12" />
          </div>
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="rounded-md border p-4 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-6 w-12" />
          </div>
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
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

  const disableCreateNew =
    !isAdmin &&
    (isAccountExpired ||
      !isTelegramConnected ||
      (!isPremium && !isTrialActivated));
  const showTrialActivationButton =
    !isAdmin && !isPremium && !isTrialActivated && isTelegramConnected;

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

        {services.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg mt-4">
            <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="font-semibold">هیچ سرویسی یافت نشد.</p>
            <p className="text-sm">برای شروع، یک سرویس جدید ایجاد کنید.</p>
          </div>
        ) : (
          <>
            {/* --- START: Mobile Card View --- */}
            <div className="md:hidden space-y-4">
              {services.map((service) => (
                <Card key={service.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="flex-1">{service.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(service)}>
                            <Pencil className="ml-2 h-4 w-4" />
                            ویرایش
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="ml-2 h-4 w-4" />
                                حذف
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  آیا مطمئن هستید؟
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  این عمل غیرقابل بازگشت است و سرویس «
                                  {service.name}» برای همیشه حذف خواهد شد.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>لغو</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(service.id)}
                                >
                                  بله، حذف کن
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription>
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
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">مبدأ:</p>
                      <p className="font-mono text-xs break-all">
                        {(service.source_channels || []).join("، ")}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">مقصد:</p>
                      <p className="font-mono text-xs break-all">
                        {(service.target_channels || []).join("، ")}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      وضعیت:
                    </span>
                    <Switch
                      checked={Boolean(service.is_active)}
                      onCheckedChange={(checked) =>
                        handleStatusChange(service.id, checked)
                      }
                      dir="ltr"
                    />
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* --- START: Desktop Table View --- */}
            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table className="min-w-full">
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
                    <TableHead className="text-right w-[100px]">
                      وضعیت
                    </TableHead>
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
                      <TableCell className="text-right py-3 max-w-xs truncate font-mono text-xs">
                        {(service.source_channels || []).join("، ")}
                      </TableCell>
                      <TableCell className="text-right py-3 max-w-xs truncate font-mono text-xs">
                        {(service.target_channels || []).join("، ")}
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <Switch
                          checked={Boolean(service.is_active)}
                          onCheckedChange={(checked) =>
                            handleStatusChange(service.id, checked)
                          }
                          dir="ltr"
                        />
                      </TableCell>
                      <TableCell className="text-center py-3 pe-4">
                        <div className="flex justify-center gap-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(service)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive/90"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  آیا مطمئن هستید؟
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  این عمل غیرقابل بازگشت است و سرویس «
                                  {service.name}» برای همیشه حذف خواهد شد.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>لغو</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(service.id)}
                                >
                                  بله، حذف کن
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
