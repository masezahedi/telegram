"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { UserService } from "@/lib/services/user-service";

// Add new function to UserService for credentials
UserService.updateCredentials = async function (credentials) {
  const token = localStorage.getItem("auth_token");
  const response = await fetch("/api/users/me/credentials", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });
  return await response.json();
};

const profileSchema = z.object({
  name: z.string().min(2, {
    message: "نام باید حداقل ۲ کاراکتر باشد.",
  }),
  email: z
    .string()
    .email({
      message: "لطفاً یک ایمیل معتبر وارد کنید.",
    })
    .optional()
    .or(z.literal("")),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().optional(), // Made optional
    newPassword: z.string().min(8, {
      message: "رمز عبور جدید باید حداقل ۸ کاراکتر باشد.",
    }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "رمزهای عبور یکسان نیستند.",
    path: ["confirmPassword"],
  });

export default function ProfileSettings({ user, onUpdate }) {
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const hasPassword = !!user?.has_password;

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmitProfile = async (values) => {
    setLoadingProfile(true);
    try {
      const credentialsToUpdate = {};
      if (values.email && !user.email) {
        credentialsToUpdate.email = values.email;
      }

      // 1. Update user name
      const profileResult = await UserService.updateProfile({
        name: values.name,
      });
      if (!profileResult.success) {
        throw new Error(profileResult.message || "خطا در بروزرسانی نام");
      }

      // 2. Set email if applicable
      if (Object.keys(credentialsToUpdate).length > 0) {
        const credentialsResult = await UserService.updateCredentials(
          credentialsToUpdate
        );
        if (!credentialsResult.success) {
          throw new Error(credentialsResult.error || "خطا در تنظیم ایمیل");
        }
      }

      onUpdate({ ...user, ...values, email: values.email || user.email });
      toast.success("پروفایل با موفقیت بروزرسانی شد!");
    } catch (error) {
      console.error("Update profile/email error:", error);
      toast.error(error.message || "خطا در بروزرسانی پروفایل");
    } finally {
      setLoadingProfile(false);
    }
  };

  const onSubmitPassword = async (values) => {
    setLoadingPassword(true);
    try {
      let result;
      if (hasPassword) {
        // Use change password service
        result = await UserService.updatePassword(values);
      } else {
        // Use set credentials service
        result = await UserService.updateCredentials({
          newPassword: values.newPassword,
        });
      }

      if (result.success) {
        passwordForm.reset({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        toast.success(
          hasPassword
            ? "رمز عبور با موفقیت تغییر کرد!"
            : "رمز عبور با موفقیت تنظیم شد!"
        );
        onUpdate({ ...user, has_password: true }); // Update user state to reflect password existence
      } else {
        toast.error(result.message || result.error || "خطا در عملیات رمز عبور");
      }
    } catch (error) {
      console.error("Password operation error:", error);
      toast.error("خطا در عملیات رمز عبور");
    } finally {
      setLoadingPassword(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="space-y-8">
      {/* Profile Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          <Avatar className="w-24 h-24">
            <AvatarImage src={user?.avatar || ""} alt={user?.name || "کاربر"} />
            <AvatarFallback className="text-xl">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <h3 className="text-xl font-medium">{user?.name || "کاربر"}</h3>
            <p className="text-muted-foreground">
              {user?.email || "ایمیل ثبت نشده"}
            </p>
          </div>
        </div>

        <Separator />

        <Form {...profileForm}>
          <form
            onSubmit={profileForm.handleSubmit(onSubmitProfile)}
            className="space-y-4"
          >
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام و نام خانوادگی</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="نام و نام خانوادگی خود را وارد کنید"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={profileForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ایمیل</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      {...field}
                      disabled={!!user?.email}
                    />
                  </FormControl>
                  {!user?.email && (
                    <FormDescription>
                      برای امکان ورود از طریق سایت، یک ایمیل معتبر وارد کنید.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={loadingProfile}>
                {loadingProfile ? "در حال بروزرسانی..." : "بروزرسانی پروفایل"}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Password Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-medium">
          {hasPassword ? "تغییر رمز عبور" : "تنظیم رمز عبور"}
        </h3>
        <Separator />

        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
            className="space-y-4"
          >
            {hasPassword && (
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رمز عبور فعلی</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="********"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={passwordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رمز عبور جدید</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تکرار رمز عبور جدید</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={loadingPassword}>
                {loadingPassword
                  ? "در حال پردازش..."
                  : hasPassword
                  ? "تغییر رمز عبور"
                  : "تنظیم رمز عبور"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
