// app/(dashboard)/dashboard/page.js
"use client";

import { useState, useEffect } from "react"; //
import { useRouter } from "next/navigation"; //
import { toast } from "sonner"; //
import { UserService } from "@/lib/services/user-service"; //
import { AuthService } from "@/lib/services/auth-service"; //
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; //
import DashboardLayout from "@/components/dashboard/dashboard-layout"; //
import TelegramConnection from "@/components/dashboard/telegram-connection"; //

export default function Dashboard() {
  const router = useRouter(); //
  const [user, setUser] = useState(null); //
  const [loading, setLoading] = useState(true); //

  const fetchAndSetUser = async (tokenForVerification = null) => {
    try {
      let userToSet = null;
      // Try getting from localStorage first
      const storedUser = AuthService.getStoredUser();
      if (storedUser) {
        userToSet = storedUser;
      } else {
        // If not in localStorage, fetch from API
        const currentUserData = await UserService.getCurrentUser(); // This now returns the user object directly or null
        if (currentUserData) {
          userToSet = {
            // Ensure structure is consistent
            ...currentUserData,
            isAdmin: Boolean(currentUserData.isAdmin),
            telegramId: currentUserData.telegramId || null,
          };
          // Update localStorage with freshly fetched data
          localStorage.setItem("user", JSON.stringify(userToSet));
        }
      }

      if (userToSet) {
        setUser(userToSet);
        return true;
      } else {
        await AuthService.logout(); // Ensure clean state
        router.replace("/login");
        return false;
      }
    } catch (error) {
      console.error("Error in fetchAndSetUser:", error);
      await AuthService.logout();
      router.replace("/login");
      return false;
    }
  };

  useEffect(() => {
    const checkAuthAndLoadUser = async () => {
      setLoading(true); //
      const isAuthenticated = await AuthService.isAuthenticated(); //

      if (!isAuthenticated) {
        router.replace("/login"); //
        setLoading(false); //
        return;
      }
      await fetchAndSetUser();
      setLoading(false); //
    };

    checkAuthAndLoadUser(); //
  }, [router]); //

  const handleTelegramConnectionUpdate = (updatedUser) => {
    // This function is called by TelegramConnection after a successful update/disconnect
    // The user object from the API response (which includes telegramId) is passed here.
    // AuthService.getStoredUser() will reflect this if UserService updated localStorage.
    // Otherwise, update localStorage here as well.
    // For simplicity, we'll assume UserService.updateTelegramSession and disconnectTelegram
    // correctly update the localStorage via their API responses.
    console.log("Dashboard: handleTelegramConnectionUpdate", updatedUser);
    setUser(updatedUser); // Update the state in Dashboard
    // Ensure localStorage is also updated if not already handled by the service calls
    if (updatedUser && typeof window !== "undefined") {
      const currentToken = localStorage.getItem("auth_token");
      AuthService.logout(); // Clear old storage
      if (currentToken) localStorage.setItem("auth_token", currentToken); // Restore token
      localStorage.setItem("user", JSON.stringify(updatedUser)); // Set new user data
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-r-transparent animate-spin"></div>
        </div>
      </DashboardLayout>
    ); //
  }

  return (
    <DashboardLayout user={user}>
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>اتصال به تلگرام</CardTitle>
            <CardDescription>
              برای استفاده از سرویس‌های تلگرام، حساب خود را متصل کنید
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user && (
              <TelegramConnection
                user={user}
                onConnectionUpdate={handleTelegramConnectionUpdate}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  ); //
}
