// components/dashboard/telegram-connection.js
"use client";

import { useState, useEffect } from "react"; //
import { useForm } from "react-hook-form"; //
import { zodResolver } from "@hookform/resolvers/zod"; //
import { z } from "zod"; //
import { toast } from "sonner"; //
import { Button } from "@/components/ui/button"; //
import { Input } from "@/components/ui/input"; //
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"; //
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; //
import { TelegramService } from "@/lib/services/telegram-service"; //
import { UserService } from "@/lib/services/user-service"; //
import { AuthService } from "@/lib/services/auth-service"; //
import { Shield } from "lucide-react"; //

// Step 1: Phone number validation
const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, { message: "شماره تلفن باید حداقل ۱۰ رقم باشد." })
    .regex(/^\+?[0-9]+$/, {
      message: "شماره تلفن فقط می‌تواند شامل اعداد و علامت + باشد.",
    }),
}); //

// Step 2: Code validation
const codeSchema = z.object({
  code: z
    .string()
    .min(5, { message: "کد تأیید باید حداقل ۵ رقم باشد." })
    .regex(/^[0-9]+$/, { message: "کد تأیید فقط می‌تواند شامل اعداد باشد." }),
}); //

// Step 3: 2FA validation
const passwordSchema = z.object({
  password: z
    .string()
    .min(1, { message: "رمز عبور دو مرحله‌ای را وارد کنید." }),
}); //

export default function TelegramConnection({ user, onConnectionUpdate }) {
  const [step, setStep] = useState(1); //
  const [loading, setLoading] = useState(false); //
  const [phoneCodeHash, setPhoneCodeHash] = useState(null); //
  const [requires2FA, setRequires2FA] = useState(false); //
  const [connected, setConnected] = useState(Boolean(user?.telegramSession)); //
  const [currentPhoneNumber, setCurrentPhoneNumber] = useState(
    user?.phoneNumber || ""
  ); //
  // No need for currentTelegramId state here, as it's passed directly in `updateUserSession`

  useEffect(() => {
    setConnected(Boolean(user?.telegramSession)); //
    setCurrentPhoneNumber(user?.phoneNumber || ""); //
  }, [user]); //

  const phoneForm = useForm({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phoneNumber: user?.phoneNumber || "",
    },
  }); //

  const codeForm = useForm({
    resolver: zodResolver(codeSchema),
    defaultValues: {
      code: "",
    },
  }); //

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
    },
  }); //

  const handleSendCode = async (data) => {
    setLoading(true); //
    setCurrentPhoneNumber(data.phoneNumber); //
    try {
      const response = await TelegramService.sendCode(data.phoneNumber); //
      if (response.success) {
        setPhoneCodeHash(response.phoneCodeHash); //
        toast.success("کد تأیید به تلگرام شما ارسال شد"); //
        setStep(2); //
      } else {
        toast.error(
          response.error || "خطا در ارسال کد. لطفاً دوباره تلاش کنید."
        ); //
      }
    } catch (error) {
      console.error("Error sending code:", error); //
      toast.error("خطا در ارسال کد. لطفاً دوباره تلاش کنید."); //
    } finally {
      setLoading(false); //
    }
  };

  const handleVerifyCode = async (data) => {
    setLoading(true); //
    try {
      const response = await TelegramService.signIn({
        phoneNumber: currentPhoneNumber, //
        phoneCodeHash: phoneCodeHash, //
        code: data.code,
      }); //

      if (response.success && response.stringSession && response.telegramId) {
        await updateUserSession(
          response.stringSession,
          response.phoneNumber || currentPhoneNumber,
          response.telegramId.toString()
        ); //
      } else if (response.requires2FA) {
        setRequires2FA(true); //
        if (response.phoneCodeHash) setPhoneCodeHash(response.phoneCodeHash); // Update if server provides it
        setStep(3); //
        toast.info("تأیید دو مرحله‌ای لازم است"); //
      } else {
        toast.error(
          response.error || "کد نامعتبر است. لطفاً دوباره تلاش کنید."
        ); //
      }
    } catch (error) {
      console.error("Error verifying code:", error); //
      toast.error("خطا در تأیید کد. لطفاً دوباره تلاش کنید."); //
    } finally {
      setLoading(false); //
    }
  };

  const handleVerify2FA = async (data) => {
    setLoading(true); //
    try {
      const response = await TelegramService.checkPassword({
        phoneNumber: currentPhoneNumber, //
        password: data.password,
      }); //

      if (response.success && response.stringSession && response.telegramId) {
        await updateUserSession(
          response.stringSession,
          response.phoneNumber || currentPhoneNumber,
          response.telegramId.toString()
        ); //
      } else {
        toast.error(
          response.error ||
            "رمز عبور دو مرحله‌ای نامعتبر است. لطفاً دوباره تلاش کنید."
        ); //
      }
    } catch (error) {
      console.error("Error verifying 2FA:", error); //
      toast.error("خطا در تأیید رمز عبور دو مرحله‌ای. لطفاً دوباره تلاش کنید."); //
    } finally {
      setLoading(false); //
    }
  };

  const updateUserSession = async (session, phoneNumber, telegramId) => {
    try {
      const response = await UserService.updateTelegramSession({
        telegramSession: session,
        phoneNumber: phoneNumber,
        telegramId: telegramId,
      }); //

      if (response.success) {
        setConnected(true); //
        toast.success("اتصال به تلگرام با موفقیت انجام شد"); //
        // Call the callback to update user state in parent component (Dashboard page)
        if (onConnectionUpdate && response.user) {
          const updatedUser = {
            ...response.user,
            isAdmin: Boolean(response.user.isAdmin), // Ensure isAdmin is boolean
          };
          AuthService.logout(); // Clear old local storage
          localStorage.setItem(
            "auth_token",
            localStorage.getItem("auth_token")
          ); // Preserve token or re-login might be cleaner
          localStorage.setItem("user", JSON.stringify(updatedUser));
          onConnectionUpdate(updatedUser);
        }
        setStep(1); //
        codeForm.reset(); //
        passwordForm.reset(); //
      } else {
        toast.error(
          response.error || "خطا در ذخیره اطلاعات. لطفاً دوباره تلاش کنید."
        ); //
      }
    } catch (error) {
      console.error("Error updating session:", error); //
      toast.error("خطا در ذخیره اطلاعات. لطفاً دوباره تلاش کنید."); //
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("آیا از قطع اتصال به تلگرام اطمینان دارید؟")) return; //

    setLoading(true); //
    try {
      const response = await UserService.disconnectTelegram(); //

      if (response.success) {
        setConnected(false); //
        toast.success("اتصال به تلگرام با موفقیت قطع شد"); //
        if (onConnectionUpdate && response.user) {
          const updatedUser = {
            ...response.user,
            isAdmin: Boolean(response.user.isAdmin),
          };
          AuthService.logout();
          localStorage.setItem(
            "auth_token",
            localStorage.getItem("auth_token")
          );
          localStorage.setItem("user", JSON.stringify(updatedUser));
          onConnectionUpdate(updatedUser);
        }
        setStep(1); //
        phoneForm.reset({ phoneNumber: "" }); //
        codeForm.reset(); //
        passwordForm.reset(); //
        setCurrentPhoneNumber(""); //
      } else {
        toast.error(
          response.error || "خطا در قطع اتصال. لطفاً دوباره تلاش کنید."
        ); //
      }
    } catch (error) {
      console.error("Error disconnecting:", error); //
      toast.error("خطا در قطع اتصال. لطفاً دوباره تلاش کنید."); //
    } finally {
      setLoading(false); //
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-600 dark:text-blue-400">
          امنیت و حریم خصوصی
        </AlertTitle>
        <AlertDescription className="text-blue-600/90 dark:text-blue-400/90">
          ما به حریم خصوصی شما احترام می‌گذاریم. اتصال به تلگرام فقط برای دسترسی
          ربات ما به کانال‌های شما استفاده می‌شود و هیچ اطلاعات شخصی یا پیام‌های
          خصوصی شما ذخیره یا خوانده نمی‌شود.
        </AlertDescription>
      </Alert>

      {connected ? (
        <div className="space-y-4">
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <AlertTitle className="text-success flex items-center">
              <div className="w-2 h-2 rounded-full bg-success mr-2 animate-pulse"></div>
              متصل به تلگرام
            </AlertTitle>
            <AlertDescription>
              شما با شماره {user?.phoneNumber || currentPhoneNumber} (آی‌دی
              تلگرام: {user?.telegramId || "در حال بارگذاری..."}) با موفقیت به
              تلگرام متصل شده‌اید.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={loading}
            >
              {loading ? "در حال قطع اتصال..." : "قطع اتصال به تلگرام"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {step === 1 && (
            <Form {...phoneForm}>
              <form
                onSubmit={phoneForm.handleSubmit(handleSendCode)}
                className="space-y-4"
              >
                <FormField
                  control={phoneForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>شماره موبایل</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="مثال: +989123456789"
                          dir="ltr"
                          {...field}
                          // defaultValue is managed by react-hook-form's defaultValues
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "در حال ارسال کد..." : "ارسال کد تأیید"}
                </Button>
              </form>
            </Form>
          )}

          {step === 2 && (
            <Form {...codeForm}>
              <form
                onSubmit={codeForm.handleSubmit(handleVerifyCode)}
                className="space-y-4"
              >
                <FormField
                  control={codeForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>کد تأیید تلگرام</FormLabel>
                      <Alert variant="default" className="my-2">
                        <AlertDescription>
                          کد به شماره {currentPhoneNumber} ارسال شد.
                        </AlertDescription>
                      </Alert>
                      <FormControl>
                        <Input
                          placeholder="کد ارسال شده به تلگرام خود را وارد کنید"
                          dir="ltr"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep(1);
                      codeForm.reset();
                    }} //
                    disabled={loading}
                  >
                    بازگشت
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "در حال تأیید کد..." : "تأیید کد"}
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {step === 3 && requires2FA && (
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit(handleVerify2FA)}
                className="space-y-4"
              >
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رمز عبور دو مرحله‌ای</FormLabel>
                      <Alert variant="default" className="my-2">
                        <AlertDescription>
                          برای شماره {currentPhoneNumber} رمز دو مرحله‌ای نیاز
                          است.
                        </AlertDescription>
                      </Alert>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="رمز عبور دو مرحله‌ای خود را وارد کنید"
                          dir="ltr"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep(2);
                      passwordForm.reset();
                    }} //
                    disabled={loading}
                  >
                    بازگشت
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "در حال تأیید رمز عبور..." : "تأیید رمز عبور"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      )}
    </div>
  );
}
