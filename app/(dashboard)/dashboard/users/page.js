// app/(dashboard)/dashboard/users/page.js
"use client";

import { useState, useEffect } from "react"; //
import { useRouter } from "next/navigation"; //
import { toast } from "sonner"; //
import { AuthService } from "@/lib/services/auth-service"; //
import { UserService } from "@/lib/services/user-service"; //
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; //
import DashboardLayout from "@/components/dashboard/dashboard-layout"; //
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; //
import { Button } from "@/components/ui/button"; //

export default function Users() {
  const router = useRouter(); //
  const [user, setUser] = useState(null); //
  const [users, setUsers] = useState([]); //
  const [loading, setLoading] = useState(true); //

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const isAuthenticated = await AuthService.isAuthenticated(); //
        if (!isAuthenticated) {
          router.replace("/login"); //
          return;
        }

        const currentUser = AuthService.getStoredUser(); //
        if (!currentUser?.is_admin) {
          //
          router.replace("/dashboard"); //
          return;
        }

        setUser(currentUser); //
        const usersData = await UserService.getAllUsers(); //
        setUsers(usersData); //
      } catch (error) {
        console.error("Error loading users:", error); //
        toast.error("خطا در بارگذاری اطلاعات"); //
      } finally {
        setLoading(false); //
      }
    };

    checkAuthAndLoadData(); //
  }, [router]); //

  const handleUserClick = (userId) => {
    router.push(`/dashboard/users/${userId}`); //
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
                  <TableHead>آی‌دی تلگرام</TableHead> {/* ستون جدید */}
                  <TableHead>وضعیت اتصال تلگرام</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(
                  (
                    uItem // Renamed user to uItem to avoid conflict
                  ) => (
                    <TableRow key={uItem.id}>
                      <TableCell>{uItem.name}</TableCell>
                      <TableCell>{uItem.email}</TableCell>
                      <TableCell>{uItem.phone_number || "-"}</TableCell>
                      <TableCell>{uItem.telegram_id || "-"}</TableCell>{" "}
                      {/* نمایش آی‌دی تلگرام */}
                      <TableCell>
                        {uItem.has_telegram_session ? ( //  استفاده از نام جدید فیلد
                          <span className="text-success">متصل</span>
                        ) : (
                          <span className="text-destructive">غیر متصل</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          onClick={() => handleUserClick(uItem.id)}
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
  ); //
}
