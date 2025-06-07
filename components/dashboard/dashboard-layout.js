// components/dashboard/dashboard-layout.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  LogOut,
  Menu,
  User,
  Home,
  Settings,
  MessageCircle,
  Users,
  DollarSign,
} from "lucide-react";
import { AuthService } from "@/lib/services/auth-service";
import ConnectionStatus from "@/components/dashboard/connection-status";

export default function DashboardLayout({ children, user }) {
  const router = useRouter();
  const pathname = usePathname(); // Get current path
  const [isMounted, setIsMounted] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const navLinks = [
    { href: "/dashboard", label: "داشبورد", icon: Home },
    { href: "/dashboard/services", label: "سرویس‌ها", icon: MessageCircle },
    { href: "/dashboard/profile", label: "پروفایل", icon: User },
    { href: "/dashboard/settings", label: "تنظیمات", icon: Settings },
  ];

  const adminNavLinks = [
    { href: "/dashboard/users", label: "مدیریت کاربران", icon: Users },
    { href: "/dashboard/tariffs", label: "مدیریت تعرفه‌ها", icon: DollarSign },
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

  const NavLink = ({ href, label, icon: Icon }) => (
    <Link href={href} passHref>
      <Button
        variant={pathname === href ? "secondary" : "ghost"}
        className="w-full justify-start text-base py-6"
        onClick={() => setIsSheetOpen(false)}
      >
        <Icon className="ml-3 h-5 w-5" /> {label}
      </Button>
    </Link>
  );

  if (!isMounted) return null; // Or a loading skeleton

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              {/* --- START: Fullscreen Menu Change --- */}
              <SheetContent
                side="right"
                className="w-full h-full p-0 flex flex-col"
              >
                {/* --- END: Fullscreen Menu Change --- */}
                <div className="p-4 border-b">
                  <h2 className="text-xl font-bold text-center">منوی کاربری</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <nav className="flex flex-col gap-1 p-4">
                    {navLinks.map((link) => (
                      <NavLink key={link.href} {...link} />
                    ))}
                    {user?.isAdmin && (
                      <>
                        <Separator className="my-2" />
                        {adminNavLinks.map((link) => (
                          <NavLink key={link.href} {...link} />
                        ))}
                      </>
                    )}
                  </nav>
                </div>
                <div className="p-4 border-t">
                  <Button
                    onClick={handleLogout}
                    variant="destructive"
                    className="w-full"
                  >
                    <LogOut className="ml-2 h-5 w-5" /> خروج از حساب
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/" className="text-2xl font-bold text-primary">
              تلگرام‌ سرویس
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <ConnectionStatus isConnected={user.isTelegramConnected} />
            )}
            <div className="hidden md:flex items-center gap-4">
              <Button variant="ghost" onClick={handleLogout} size="sm">
                <LogOut className="ml-2 h-4 w-4" />
                خروج
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar and Content */}
      <div className="flex-1 flex">
        {/* Sidebar - Desktop only */}
        <aside className="hidden md:flex w-64 border-l flex-col p-4">
          <div className="flex flex-col flex-1 gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold mb-2">منوی سایت</h2>
              <Separator className="mb-4" />
              <nav className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <NavLink key={link.href} {...link} />
                ))}
                {user?.isAdmin && (
                  <>
                    <Separator className="my-2" />
                    {adminNavLinks.map((link) => (
                      <NavLink key={link.href} {...link} />
                    ))}
                  </>
                )}
              </nav>
            </div>
          </div>

          <div className="mt-auto">
            <Separator className="mb-4" />
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="ml-2 h-5 w-5" /> خروج از حساب
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
