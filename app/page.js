"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AuthService } from "@/lib/services/auth-service";
import { Bot, LogIn, UserPlus } from "lucide-react";

// آیتم‌های منو در اینجا تعریف شده‌اند
const navItems = [
  { label: "خانه", href: "/" },
  { label: "معرفی سرویس‌ها", href: "/services-info" }, // لینک‌ها را در صورت نیاز تغییر دهید
  { label: "ارتباط با ما", href: "#" },
  { label: "قوانین", href: "#" },
];

export default function Home() {
  const router = useRouter();
  // وضعیت احراز هویت: 'loading', 'authenticated', 'unauthenticated'
  const [authStatus, setAuthStatus] = useState("loading");

  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = await AuthService.isAuthenticated();
      if (isAuthenticated) {
        setAuthStatus("authenticated");
        // اگر کاربر لاگین کرده بود، به داشبورد منتقل شود
        router.replace("/dashboard");
      } else {
        setAuthStatus("unauthenticated");
      }
    };
    checkAuth();
  }, [router]);

  // نمایش حالت لودینگ تا وضعیت کاربر مشخص شود
  if (authStatus === "loading" || authStatus === "authenticated") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center p-4">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        <p className="mt-4 text-muted-foreground">
          در حال انتقال به داشبورد...
        </p>
      </div>
    );
  }

  // نمایش صفحه اصلی برای کاربرانی که لاگین نکرده‌اند
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 overflow-hidden relative">
      {/* START: منوی جدید و جذاب */}
      <motion.nav
        className="absolute top-0 left-0 p-6 z-30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <div className="flex items-center gap-4 md:gap-6">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} passHref>
              <span className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </motion.nav>
      {/* END: منوی جدید */}

      {/* Background Effects */}
      <div className="absolute inset-0 z-0 bg-grid-slate-100/10 [mask-image:radial-gradient(ellipse_at_center,white,transparent)] dark:bg-grid-slate-700/10"></div>
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-background/10 via-background to-background"></div>

      <motion.div
        className="z-20 text-center flex flex-col items-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {/* Animated Icon */}
        <motion.div
          className="mb-6 p-4 bg-primary/10 rounded-full shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.2,
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
        >
          <Bot className="h-12 w-12 text-primary" />
        </motion.div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70 pb-2">
          هوشمند، سریع، قدرتمند
        </h1>

        {/* Slogan & Description */}
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          مدیریت کانال‌های تلگرام خود را به سطح جدیدی ببرید.
          <br />
          با سرویس‌های اتوماسیون ما، زمان خود را بر روی محتوای ارزشمند متمرکز
          کنید.
        </p>

        {/* Buttons */}
        <motion.div
          className="mt-10 flex flex-col sm:flex-row items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Link href="/login" passHref>
            <Button size="lg" className="w-40 gap-2">
              <LogIn className="h-4 w-4" />
              ورود
            </Button>
          </Link>
          <Link href="/register" passHref>
            <Button size="lg" variant="secondary" className="w-40 gap-2">
              <UserPlus className="h-4 w-4" />
              ثبت نام
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}
