// app/(dashboard)/dashboard/users/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthService } from "@/lib/services/auth-service";
import { UserService } from "@/lib/services/user-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default function Users() {
  const router = useRouter();
  const [user, setUser] = useState(null); // This state holds the *current logged-in user*
  const [users, setUsers] = useState([]); // This state holds the *list of all users*
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const isAuthenticated = await AuthService.isAuthenticated();
        if (!isAuthenticated) {
          router.replace("/login");
          return;
        }

        const currentUser = AuthService.getStoredUser(); // Fetches from localStorage
        if (!currentUser?.isAdmin) {
          // <<< THIS IS THE CHECK
          toast.error("دسترسی غیر مجاز: شما ادمین نیستید."); // Added toast for clarity
          router.replace("/dashboard");
          return;
        }

        setUser(currentUser); // Set the logged-in admin user
        const usersData = await UserService.getAllUsers(); // Fetches all users for the table
        setUsers(usersData);
      } catch (error) {
        console.error("Error loading users page:", error);
        toast.error("خطا در بارگذاری اطلاعات صفحه کاربران");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadData();
  }, [router]);

  const handleUserClick = (userId) => {
    router.push(`/dashboard/users/${userId}`);
  };

  if (loading) {
    return (
      <DashboardLayout user={user}>
        {" "}
        {/* Pass the logged-in admin user to layout */}
        <div className="h-full flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-r-transparent animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      {" "}
      {/* Pass the logged-in admin user to layout */}
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>مدیریت کاربران</CardTitle>
            <CardDescription>
              لیست تمامی کاربران ثبت نام شده در سیستم
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>ایمیل</TableHead>
                  <TableHead>شماره تلفن</TableHead>
                  <TableHead>وضعیت اتصال تلگرام</TableHead>
                  <TableHead>وضعیت پرمیوم</TableHead>
                  <TableHead>تاریخ انقضای پرمیوم</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(
                  (
                    u // Renamed to 'u' to avoid conflict with 'user' state
                  ) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.phone_number || "-"}</TableCell>
                      <TableCell>
                        {u.has_telegram ? ( // Assuming 'has_telegram' comes from API
                          <span className="text-success">متصل</span>
                        ) : (
                          <span className="text-destructive">غیر متصل</span>
                        )}
                      </TableCell>
                      <TableCell>{u.is_premium ? "پرمیوم" : "عادی"}</TableCell>
                      <TableCell>
                        {u.premium_expiry_date
                          ? new Date(u.premium_expiry_date).toLocaleDateString(
                              "fa-IR"
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          onClick={() => handleUserClick(u.id)}
                        >
                          مشاهده جزئیات
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
