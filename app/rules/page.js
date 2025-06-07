"use client"; // <--- این خط برای رفع خطا اضافه شده است

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Gavel } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// منوی مشترک برای تمام صفحات
const navItems = [
  { label: "خانه", href: "/" },
  { label: "معرفی سرویس‌ها", href: "/services-info" },
  { label: "ارتباط با ما", href: "#" },
  { label: "قوانین", href: "/rules" },
];

const rulesSections = [
  {
    title: "ماده ۱: شرایط عمومی استفاده",
    items: [
      "استفاده از خدمات ما به منزله پذیرش کامل و بدون قید و شرط تمامی این قوانین است.",
      "کاربران موظف به حفظ اطلاعات حساب کاربری خود (ایمیل و رمز عبور) هستند و مسئولیت تمامی فعالیت‌هایی که از طریق حساب آن‌ها انجام می‌شود بر عهده خودشان است.",
      "هر کاربر تنها مجاز به داشتن یک حساب کاربری است. ایجاد چندین حساب برای یک شخص ممنوع می‌باشد.",
    ],
  },
  {
    title: "ماده ۲: محتوای ممنوعه",
    items: [
      "کاربران متعهد می‌شوند که از این سرویس برای مدیریت، فوروارد یا کپی هرگونه محتوay غیرقانونی، غیراخلاقی، توهین‌آمیز، کلاهبرداری، اسپم، دارای کپی‌رایت و ناقض حریم خصوصی دیگران استفاده نکنند.",
      "انتشار هرگونه محتوایی که قوانین جمهوری اسلامی ایران و همچنین قوانین بین‌المللی را نقض کند، اکیداً ممنوع است.",
      "مسئولیت کامل محتوای جابجا شده از طریق سرویس‌های ما بر عهده کاربر است و تلگرام سرویس هیچ‌گونه مسئولیتی در قبال آن ندارد.",
    ],
  },
  {
    title: "ماده ۳: مسئولیت‌ها و محدودیت‌های سرویس",
    items: [
      "عملکرد صحیح سرویس‌های ما به API و زیرساخت پیام‌رسان تلگرام وابسته است. هرگونه اختلال یا تغییر در سرویس تلگرام ممکن است بر عملکرد خدمات ما تأثیر بگذارد.",
      "تلگرام سرویس هیچ‌گونه مسئولیتی در قبال مسدود شدن یا محدودیت‌های اعمال شده بر روی حساب‌های تلگرام کاربران که ناشی از استفاده نادرست یا بیش از حد از سرویس‌ها باشد، بر عهده نمی‌گیرد.",
      "ما تمام تلاش خود را برای ارائه خدمات پایدار به کار می‌گیریم، اما هیچ تضمینی برای عملکرد بدون وقفه و بدون خطای سرویس وجود ندارد.",
    ],
  },
  {
    title: "ماده ۴: حساب‌های کاربری و اشتراک",
    items: [
      "هرگونه سوءاستفاده از طرح‌های آزمایشی یا تلاش برای دور زدن محدودیت‌های حساب‌های عادی و پرمیوم، منجر به مسدود شدن حساب کاربری خواهد شد.",
      "امکان انتقال اشتراک یا فروش حساب کاربری به شخص ثالث وجود ندارد.",
      "تلگرام سرویس این حق را برای خود محفوظ می‌دارد که در صورت نقض هر یک از قوانین، حساب کاربری متخلف را بدون اطلاع قبلی و بدون بازگشت وجه، مسدود یا حذف نماید.",
    ],
  },
];

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-background">
      <motion.nav
        className="absolute top-0 left-0 right-0 p-6 z-30 flex justify-center md:justify-start"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-4 md:gap-6 bg-background/50 backdrop-blur-sm p-2 px-4 rounded-full border">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} passHref>
              <span className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </motion.nav>

      <main className="container pt-32 pb-16">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-block p-4 bg-destructive/10 rounded-full mb-4">
            <Gavel className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
            قوانین و مقررات استفاده
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-muted-foreground">
            استفاده شما از خدمات ما به منزله پذیرش این قوانین است. لطفاً آن‌ها
            را با دقت مطالعه فرمایید.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto space-y-8">
          {rulesSections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-primary" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 list-disc pr-5 text-muted-foreground">
                    {section.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 border-t mt-16">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} تلگرام سرویس. تمامی حقوق محفوظ است.
        </p>
      </footer>
    </div>
  );
}
