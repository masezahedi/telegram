"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
// MessageCircle به لیست ایمپورت‌ها اضافه شده است
import { Plus, Pencil, Trash2, Info, Eye, MessageCircle } from "lucide-react";
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

export default function ForwardingServiceList({ onUpdate, userAccountStatus }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState(null);
  const [showForm, setShowForm] = useState(false);

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
    if (
      newIsActiveStatus &&
      userAccountStatus?.isExpired &&
      !userAccountStatus?.isAdmin
    ) {
      toast.error(
        "مهلت استفاده شما از سرویس‌ها به پایان رسیده است. امکان فعال‌سازی سرویس وجود ندارد."
      );
      await loadServices();
      return;
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
    if (
      userAccountStatus?.isExpired &&
      !userAccountStatus?.isPremium &&
      !userAccountStatus?.isAdmin
    ) {
      toast.error(
        "مهلت استفاده شما به پایان رسیده و امکان ویرایش سرویس وجود ندارد."
      );
      return;
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

  const disableCreateNew =
    userAccountStatus?.isExpired &&
    !userAccountStatus?.isPremium &&
    !userAccountStatus?.isAdmin;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
        <div className="flex justify-start">
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
              امکان ایجاد سرویس جدید وجود ندارد. مهلت استفاده شما به پایان رسیده
              است.
            </AlertDescription>
          </Alert>
        )}

        {services.length === 0 && !loading ? (
          <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg mt-4">
            <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />{" "}
            {/* استفاده از MessageCircle */}
            <p className="font-semibold">هیچ سرویسی یافت نشد.</p>
            <p className="text-sm">برای شروع، یک سرویس جدید ایجاد کنید.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-full">
              <TableCaption className="py-4">
                لیست سرویس‌های فوروارد و کپی شما.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-[200px]">
                    نام سرویس
                  </TableHead>
                  <TableHead className="text-right w-[150px]">
                    نوع سرویس
                  </TableHead>
                  <TableHead className="text-right">کانال‌های مبدا</TableHead>
                  <TableHead className="text-right">کانال‌های مقصد</TableHead>
                  <TableHead className="text-right w-[100px]">وضعیت</TableHead>
                  <TableHead className="text-center w-[120px]">
                    عملیات
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id} className="hover:bg-muted/50">
                    <TableCell className="text-right font-medium py-3">
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
                        <TooltipContent>
                          <p className="text-right">
                            {(Array.isArray(service.source_channels)
                              ? service.source_channels
                              : []
                            ).map((ch) => (
                              <div key={ch}>{ch}</div>
                            ))}
                          </p>
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
                        <TooltipContent>
                          <p className="text-right">
                            {(Array.isArray(service.target_channels)
                              ? service.target_channels
                              : []
                            ).map((ch) => (
                              <div key={ch}>{ch}</div>
                            ))}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <Switch
                        checked={Boolean(service.is_active)}
                        onCheckedChange={(checked) =>
                          handleStatusChange(service.id, checked)
                        }
                        disabled={
                          userAccountStatus?.isExpired &&
                          !service.is_active &&
                          !userAccountStatus?.isAdmin
                        }
                        aria-label={`فعال/غیرفعال سازی سرویس ${service.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <div className="flex justify-center gap-x-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(service)}
                              disabled={
                                userAccountStatus?.isExpired &&
                                !userAccountStatus?.isPremium &&
                                !userAccountStatus?.isAdmin
                              }
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
