"use client";
import {
  Bell,
  Home,
  Users,
  Settings,
  User,
  LogOut,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserService } from "@/lib/services/user-service";
import { AuthService } from "@/lib/services/auth-service";
import { useRouter } from "next/navigation";
import ConnectionStatus from "./connection-status";
import { isAfter } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import UpgradeButton from "./UpgradeButton"; // فایل جدید
import { TariffService } from "@/lib/services/tariff-service"; // سرویس تعرفه

const SidebarLink = ({ href, children }) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
        isActive ? "bg-muted text-primary" : ""
      }`}
    >
      {children}
    </Link>
  );
};
export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  // START: وضعیت‌های جدید
  const [showUpgradeAlert, setShowUpgradeAlert] = useState(false);
  const [premiumTariffId, setPremiumTariffId] = useState(null);
  // END: وضعیت‌های جدید

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await UserService.getCurrentUser();
        setUser(currentUser);

        // START: بررسی انقضای اشتراک
        if (currentUser.tariff_id) {
          const tariffs = await TariffService.getTariffs();
          const premiumTariff = tariffs.find((t) => t.name === "پرمیوم");
          if (premiumTariff) setPremiumTariffId(premiumTariff.id);

          const userTariff = tariffs.find(
            (t) => t.id === currentUser.tariff_id
          );

          // اگر تعرفه کاربر آزمایشی است و تاریخ انقضا گذشته
          if (
            userTariff &&
            userTariff.name === "آزمایشی" &&
            currentUser.tariff_expiry
          ) {
            if (isAfter(new Date(), new Date(currentUser.tariff_expiry))) {
              setShowUpgradeAlert(true);
            }
          }
        }
        // END: بررسی انقضای اشتراک
      } catch (error) {
        router.push("/login");
      }
    };
    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    await AuthService.logout();
    router.push("/login");
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="">سرویس تلگرام</span>
            </Link>
            <Button variant="outline" size="icon" className="ml-auto h-8 w-8">
              <Bell className="h-4 w-4" />
              <span className="sr-only">Toggle notifications</span>
            </Button>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <SidebarLink href="/dashboard">
                <Home className="h-4 w-4" />
                داشبورد
              </SidebarLink>
              <SidebarLink href="/dashboard/services">
                <Home className="h-4 w-4" />
                سرویس ها
              </SidebarLink>
              {user?.role === "admin" && (
                <>
                  <SidebarLink href="/dashboard/users">
                    <Users className="h-4 w-4" />
                    کاربران
                  </SidebarLink>
                  <SidebarLink href="/dashboard/tariffs">
                    <CreditCard className="h-4 w-4" />
                    تعرفه ها
                  </SidebarLink>
                </>
              )}
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Home className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <nav className="grid gap-6 text-lg font-medium">
                <SidebarLink href="/dashboard">داشبورد</SidebarLink>
                <SidebarLink href="/dashboard/services">سرویس ها</SidebarLink>
                {user?.role === "admin" && (
                  <>
                    <SidebarLink href="/dashboard/users">کاربران</SidebarLink>
                    <SidebarLink href="/dashboard/tariffs">
                      تعرفه ها
                    </SidebarLink>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1">
            <ConnectionStatus />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <User className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {user ? user.name : "کاربر"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">
                  <User className="mr-2 h-4 w-4" />
                  <span>پروفایل</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>تنظیمات</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>خروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {/* START: نمایش بنر ارتقا */}
          {showUpgradeAlert && premiumTariffId && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>اشتراک آزمایشی شما به پایان رسیده است!</AlertTitle>
              <AlertDescription className="flex justify-between items-center">
                برای استفاده نامحدود از سرویس‌ها، حساب خود را به پرمیوم ارتقا
                دهید.
                <UpgradeButton tariffId={premiumTariffId}>
                  ارتقا به پرمیوم
                </UpgradeButton>
              </AlertDescription>
            </Alert>
          )}
          {/* END: نمایش بنر ارتقا */}
          {children}
        </main>
      </div>
    </div>
  );
}
