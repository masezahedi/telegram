"use client";

import Link from "next/link";
import { motion, useInView, useAnimation } from "framer-motion";
import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  MessageSquareShare,
  CopyPlus,
  Cpu,
  BookCopy,
} from "lucide-react";

// همان منوی صفحه اصلی برای حفظ یکپارچگی
const navItems = [
  { label: "خانه", href: "/" },
  { label: "معرفی سرویس‌ها", href: "/services-info" },
  { label: "ارتباط با ما", href: "#" },
  { label: "قوانین", href: "#" },
];

const services = [
  {
    icon: MessageSquareShare,
    title: "سرویس فوروارد هوشمند",
    description:
      "ابزاری قدرتمند برای هدایت و مدیریت جریان محتوا بین کانال‌های مختلف. پیام‌ها را به صورت آنی از چندین مبدأ به چندین مقصد ارسال کنید و در این بین، آن‌ها را با هوش مصنوعی و قوانین جایگزینی، بهینه نمایید.",
    features: [
      "پشتیبانی از چند مبدأ و چند مقصد به صورت همزمان",
      "پردازش متن با هوش مصنوعی (ترجمه، خلاصه‌سازی و...)",
      "قوانین جستجو و جایگزینی برای پاک‌سازی محتوا",
      "پشتیبانی کامل از ویرایش پیام‌های ارسال شده",
    ],
    align: "right", // برای چیدمان متناوب
  },
  {
    icon: CopyPlus,
    title: "سرویس کپی و بایگانی کانال",
    description:
      "به سادگی یک کپی کامل از تمام محتوای یک کانال تهیه کنید. این سرویس برای ساخت بکاپ، آرشیو کردن محتوای ارزشمند یا انتقال کامل یک کانال به مقصدی جدید، ایده‌آل و بی‌نقص است.",
    features: [
      "کپی تاریخچه پیام‌ها با تعیین محدودیت دلخواه (تا ۱۰,۰۰۰ پیام)",
      "امکان شروع فرآیند کپی از یک پیام خاص",
      "تعیین جهت کپی (از جدیدترین یا قدیمی‌ترین پیام‌ها)",
      "حفظ ساختار و فرمت اصلی پیام‌ها در مقصد",
    ],
    align: "left", // برای چیدمان متناوب
  },
];

// کامپوننت کارت سرویس با انیمیشن‌های اختصاصی
const ServiceCard = ({ service, index }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  const isRightAligned = service.align === "right";

  return (
    <motion.div
      ref={ref}
      variants={cardVariants}
      initial="hidden"
      animate={controls}
      className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center"
    >
      <div className={`lg:order-${isRightAligned ? 1 : 2}`}>
        <div className="p-4 bg-primary/10 rounded-full w-fit mb-4 text-primary">
          <service.icon className="h-10 w-10" />
        </div>
        <h2 className="text-3xl font-bold mb-4">{service.title}</h2>
        <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
          {service.description}
        </p>
        <ul className="space-y-3">
          {service.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-500 mt-1 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <motion.div
        className={`lg:order-${
          isRightAligned ? 2 : 1
        } bg-card p-8 rounded-2xl shadow-lg border h-full flex items-center justify-center`}
        whileHover={{ scale: 1.03 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        {/* Placeholder for an image or a more complex visual */}
        <div className="text-center text-muted-foreground">
          <service.icon className="h-24 w-24 mx-auto text-primary/50" />
          <p className="mt-4 text-sm">نمایش بصری سرویس</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function ServicesInfoPage() {
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
          className="text-center mb-20"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
            معرفی سرویس‌های ما
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-muted-foreground">
            ابزارهایی قدرتمند برای بهینه‌سازی و اتوماسیون فعالیت‌های شما در
            تلگرام.
          </p>
        </motion.div>

        <div className="space-y-24">
          {services.map((service, index) => (
            <ServiceCard key={index} service={service} index={index} />
          ))}
        </div>

        <motion.div
          className="text-center mt-24"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8 }}
        >
          <h3 className="text-2xl font-bold mb-4">آماده‌اید شروع کنید؟</h3>
          <p className="text-muted-foreground mb-6">
            همین حالا ثبت‌نام کنید و مدیریت هوشمند کانال‌های خود را آغاز نمایید.
          </p>
          <Link href="/register" passHref>
            <Button size="lg">ایجاد حساب کاربری رایگان</Button>
          </Link>
        </motion.div>
      </main>

      {/* Simple Footer */}
      <footer className="text-center py-6 border-t mt-16">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} تلگرام سرویس. تمامی حقوق محفوظ است.
        </p>
      </footer>
    </div>
  );
}
