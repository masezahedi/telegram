// components/dashboard/dashboard-layout.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LogOut,
  User,
  Home,
  Settings,
  MessageCircle,
  Users,
  DollarSign,
  PlusCircle,
} from "lucide-react";
import { AuthService } from "@/lib/services/auth-service";
import ConnectionStatus from "@/components/dashboard/connection-status";

export default function DashboardLayout({ children, user }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  // --- Links for Desktop Sidebar ---
  const sidebarNavLinks = [
    { href: "/dashboard", label: "داشبورد", icon: Home },
    { href: "/dashboard/services", label: "سرویس‌ها", icon: MessageCircle },
    { href: "/dashboard/profile", label: "پروفایل", icon: User },
    { href: "/dashboard/settings", label: "تنظیمات", icon: Settings },
  ];

  const adminSidebarNavLinks = [
    { href: "/dashboard/users", label: "مدیریت کاربران", icon: Users },
    { href: "/dashboard/tariffs", label: "مدیریت تعرفه‌ها", icon: DollarSign },
  ];

  // --- Links for Mobile Bottom Navbar ---
  const mobileNavLinks = [
    { href: "/dashboard/services", label: "سرویس‌ها", icon: MessageCircle },
    { href: "/dashboard", label: "داشبورد", icon: Home },
    { href: "/dashboard/profile", label: "پروفایل", icon: User },
  ];

  useEffect(() => {
    setIsMounted(true);
    const checkAuth = async () => {
      const isAuthenticated = await AuthService.isAuthenticated();
      if (!isAuthenticated) {
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await AuthService.logout();
    router.push("/login");
  };

  const SidebarNavLink = ({ href, label, icon: Icon }) => (
    <Link href={href} passHref>
      <Button
        variant={pathname === href ? "secondary" : "ghost"}
        className="w-full justify-start"
      >
        <Icon className="ml-2 h-5 w-5" /> {label}
      </Button>
    </Link>
  );

  const MobileNavLink = ({ href, label, icon: Icon }) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        className={`flex flex-col items-center justify-center gap-1 w-full transition-colors ${
          isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
        }`}
      >
        <Icon className="h-6 w-6" />
        <span className="text-xs font-medium">{label}</span>
      </Link>
    );
  };

  if (!isMounted) {
    // You can add a loading skeleton for the layout here
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-primary border-r-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            تلگرام‌ سرویس
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <ConnectionStatus isConnected={user.isTelegramConnected} />
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 border-l flex-col p-4 bg-background">
          <nav className="flex flex-col gap-1 flex-1">
            {sidebarNavLinks.map((link) => (
              <SidebarNavLink key={link.href} {...link} />
            ))}
            {user?.isAdmin && (
              <>
                <Separator className="my-2" />
                {adminSidebarNavLinks.map((link) => (
                  <SidebarNavLink key={link.href} {...link} />
                ))}
              </>
            )}
          </nav>
          <div className="mt-auto">
            <Separator className="mb-4" />
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="ml-2 h-5 w-5" /> خروج از حساب
            </Button>
          </div>
        </aside>

        {/* Page Content - Added padding for mobile bottom nav */}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      {/* --- START: Mobile Bottom Navigation --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background shadow-t-lg z-50">
        <nav className="flex items-center justify-around h-16 px-2">
          {mobileNavLinks.map((link) => (
            <MobileNavLink key={link.href} {...link} />
          ))}
          <Link
            href="/dashboard/settings"
            className="flex flex-col items-center justify-center gap-1 w-full text-muted-foreground hover:text-primary transition-colors"
          >
            <Settings className="h-6 w-6" />
            <span className="text-xs font-medium">تنظیمات</span>
          </Link>
        </nav>
      </div>
      {/* --- END: Mobile Bottom Navigation --- */}
    </div>
  );
}
