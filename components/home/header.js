"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { AuthService } from '@/lib/services/auth-service';

export default function Header() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      const authStatus = await AuthService.isAuthenticated();
      setIsAuthenticated(authStatus);
    };
    
    checkAuth();
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const headerClass = isScrolled 
    ? "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur transition-all"
    : "sticky top-0 z-50 w-full bg-transparent transition-all";

  return (
    <header className={headerClass}>
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 sm:w-80">
              <div className="mt-8 flex flex-col gap-4">
                <Link href="/" className="text-lg font-bold">
                  صفحه اصلی
                </Link>
                <Link href="/about" className="text-lg">
                  درباره ما
                </Link>
                <Link href="/services" className="text-lg">
                  خدمات
                </Link>
                <Link href="/contact" className="text-lg">
                  تماس با ما
                </Link>
                {isAuthenticated ? (
                  <Link href="/dashboard" className="text-lg">
                    <Button variant="default" size="lg" className="w-full">
                      داشبورد
                    </Button>
                  </Link>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link href="/login">
                      <Button variant="outline" size="lg" className="w-full">
                        ورود
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button variant="default" size="lg" className="w-full">
                        ثبت نام
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
          
          <Link href="/" className="text-2xl font-bold text-primary">
            تلگرام‌ سرویس
          </Link>
        </div>
        
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
            صفحه اصلی
          </Link>
          <Link href="/about" className="text-sm font-medium hover:text-primary transition-colors">
            درباره ما
          </Link>
          <Link href="/services" className="text-sm font-medium hover:text-primary transition-colors">
            خدمات
          </Link>
          <Link href="/contact" className="text-sm font-medium hover:text-primary transition-colors">
            تماس با ما
          </Link>
        </nav>
        
        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button>داشبورد</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="outline">ورود</Button>
              </Link>
              <Link href="/register">
                <Button>ثبت نام</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}