"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ForwardingService } from "@/lib/services/forwarding-service";
import ForwardingServiceForm from "./forwarding-service-form";
import { Alert, AlertDescription } from "@/components/ui/alert"; // Added
import { Info } from "lucide-react"; // Added

export default function ForwardingServiceList({ onUpdate, userAccountStatus }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const loadServices = async () => {
    setLoading(true); // Ensure loading is true at the start
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
  }, []); // Load services on initial mount

  const handleStatusChange = async (id, newIsActiveStatus) => {
    if (
      newIsActiveStatus &&
      userAccountStatus?.isExpired &&
      !userAccountStatus?.isAdmin
    ) {
      toast.error(
        "مهلت استفاده شما از سرویس‌ها به پایان رسیده است. امکان فعال‌سازی سرویس وجود ندارد."
      );
      await loadServices(); // Refresh list to show actual state from server
      return;
    }
    try {
      const result = await ForwardingService.updateServiceStatus(
        id,
        newIsActiveStatus
      );
      if (result.success) {
        // setServices(
        //   services.map((service) =>
        //     service.id === id ? { ...service, is_active: newIsActiveStatus } : service
        //   )
        // ); // Optimistic update
        await loadServices(); // Fetch fresh list from server
        toast.success(
          newIsActiveStatus
            ? "سرویس با موفقیت فعال شد"
            : "سرویس با موفقیت غیرفعال شد"
        );
        onUpdate?.(); // Notify parent to refresh user status
      } else {
        toast.error(result.error || "خطا در تغییر وضعیت سرویس");
        await loadServices(); // Refresh list if server denied the change
      }
    } catch (error) {
      console.error("Update service status error:", error);
      toast.error("خطا در تغییر وضعیت سرویس");
      await loadServices(); // Refresh list on any error
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("آیا از حذف این سرویس اطمینان دارید؟")) return;
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
    loadServices(); // Reload services after form success
    onUpdate?.(); // Notify parent
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
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">
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

  // Disable "Create New Service" button if normal user's trial is expired
  const disableCreateNew =
    userAccountStatus?.isExpired &&
    !userAccountStatus?.isPremium &&
    !userAccountStatus?.isAdmin;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowForm(true)}
          className="gap-2"
          disabled={disableCreateNew}
        >
          <Plus className="h-4 w-4" />
          ایجاد سرویس جدید
        </Button>
      </div>
      {disableCreateNew && (
        <Alert variant="destructive" className="mt-2">
          <Info className="h-4 w-4" />
          <AlertDescription>
            امکان ایجاد سرویس جدید وجود ندارد. مهلت استفاده شما به پایان رسیده
            است.
          </AlertDescription>
        </Alert>
      )}

      {services.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          هیچ سرویسی یافت نشد
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">نام سرویس</TableHead>
                <TableHead className="text-right">نوع سرویس</TableHead>
                <TableHead className="text-right">کانال‌های مبدا</TableHead>
                <TableHead className="text-right">کانال‌های مقصد</TableHead>
                <TableHead className="text-right">وضعیت</TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="text-right font-medium">
                    {service.name}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        service.type === "copy" ? "secondary" : "default"
                      }
                    >
                      {service.type === "copy" ? "کپی کانال" : "فوروارد خودکار"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {(Array.isArray(service.source_channels)
                      ? service.source_channels
                      : []
                    ).join(", ")}
                  </TableCell>
                  <TableCell className="text-right">
                    {(Array.isArray(service.target_channels)
                      ? service.target_channels
                      : []
                    ).join(", ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={Boolean(service.is_active)}
                      onCheckedChange={(checked) =>
                        handleStatusChange(service.id, checked)
                      }
                      // Disable activation if account is expired, but allow deactivation
                      disabled={
                        userAccountStatus?.isExpired &&
                        !service.is_active &&
                        !userAccountStatus?.isAdmin
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
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
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(service.id)}
                        // Deletion is always allowed
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
