"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const AuthService = {
  async telegramLogin(initData) {
    try {
      const response = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          message: data.error || "Authentication failed.",
        };
      }

      if (data.success && typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
      }
      return data;
    } catch (error) {
      console.error("Telegram login error:", error);
      return { success: false, message: error.message };
    }
  },
};

export default function TelegramAuth() {
  const router = useRouter();
  const [status, setStatus] = useState("در حال اعتبارسنجی...");

  useEffect(() => {
    const authenticate = async () => {
      if (
        typeof window.Telegram?.WebApp?.initData === "undefined" ||
        window.Telegram.WebApp.initData === ""
      ) {
        setStatus(
          "خطا: اطلاعات تلگرام یافت نشد. لطفاً از طریق اپلیکیشن تلگرام وارد شوید."
        );
        toast.error("لطفاً این صفحه را از طریق ربات تلگرام باز کنید.");
        setTimeout(() => router.replace("/login"), 3000);
        return;
      }

      try {
        const result = await AuthService.telegramLogin(
          window.Telegram.WebApp.initData
        );
        if (result.success) {
          setStatus("اعتبارسنجی موفق! در حال انتقال به داشبورد...");
          toast.success("با موفقیت وارد شدید!");
          router.replace("/dashboard");
        } else {
          setStatus(`خطا در اعتبارسنجی: ${result.message}`);
          toast.error(result.message || "خطا در ورود از طریق تلگرام.");
        }
      } catch (error) {
        console.error("Auth error:", error);
        setStatus("خطای غیرمنتظره در سرور.");
        toast.error("خطای غیرمنتظره در سرور.");
      }
    };

    authenticate();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="h-10 w-10 rounded-full border-4 border-primary border-r-transparent animate-spin mb-4"></div>
      <h1 className="text-xl font-semibold mb-2">ورود از طریق تلگرام</h1>
      <p className="text-muted-foreground">{status}</p>
    </div>
  );
}
