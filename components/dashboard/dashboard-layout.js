"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { 
  LogOut, 
  Menu, 
  User, 
  Home, 
  Settings, 
  MessageCircle
} from 'lucide-react';
import { AuthService } from '@/lib/services/auth-service';
import ConnectionStatus from '@/components/dashboard/connection-status';

export default function DashboardLayout({ children, user }) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Verify authentication
    const checkAuth = async () => {
      const isAuthenticated = await AuthService.isAuthenticated();
      if (!isAuthenticated) {
        router.push('/login');
      }
    };
    
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await AuthService.logout();
    router.push('/login');
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 sm:w-80">
                <div className="flex flex-col h-full">
                  <div className="py-4">
                    <h2 className="text-lg font-semibold mb-2">منوی سایت</h2>
                    <Separator />
                  </div>
                  <div className="flex-1">
                    <nav className="flex flex-col gap-2">
                      <Link href="/dashboard" passHref>
                        <Button variant="ghost" className="w-full justify-start">
                          <Home className="ml-2 h-5 w-5" /> داشبورد
                        </Button>
                      </Link>
                      <Link href="/dashboard/profile" passHref>
                        <Button variant="ghost" className="w-full justify-start">
                          <User className="ml-2 h-5 w-5" /> پروفایل
                        </Button>
                      </Link>
                      <Link href="/dashboard/settings" passHref>
                        <Button variant="ghost" className="w-full justify-start">
                          <Settings className="ml-2 h-5 w-5" /> تنظیمات
                        </Button>
                      </Link>
                      <Link href="/dashboard/services" passHref>
                        <Button variant="ghost" className="w-full justify-start">
                          <MessageCircle className="ml-2 h-5 w-5" /> سرویس‌ها
                        </Button>
                      </Link>
                    </nav>
                  </div>
                  <div className="py-4">
                    <Separator className="mb-4" />
                    <Button onClick={handleLogout} variant="destructive" className="w-full">
                      <LogOut className="ml-2 h-5 w-5" /> خروج
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            
            <Link href="/" className="text-2xl font-bold text-primary">
              تلگرام‌ سرویس
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            {user && <ConnectionStatus isConnected={Boolean(user.telegramSession)} />}
            
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
                <Link href="/dashboard" passHref>
                  <Button variant="ghost" className="w-full justify-start">
                    <Home className="ml-2 h-5 w-5" /> داشبورد
                  </Button>
                </Link>
                <Link href="/dashboard/profile" passHref>
                  <Button variant="ghost" className="w-full justify-start">
                    <User className="ml-2 h-5 w-5" /> پروفایل
                  </Button>
                </Link>
                <Link href="/dashboard/settings" passHref>
                  <Button variant="ghost" className="w-full justify-start">
                    <Settings className="ml-2 h-5 w-5" /> تنظیمات
                  </Button>
                </Link>
                <Link href="/dashboard/services" passHref>
                  <Button variant="ghost" className="w-full justify-start">
                    <MessageCircle className="ml-2 h-5 w-5" /> سرویس‌ها
                  </Button>
                </Link>
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
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}