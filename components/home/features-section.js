"use client";

import { useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { MessageCircle, Copy } from "lucide-react";

const features = [
  {
    icon: <MessageCircle className="h-8 w-8" />,
    title: "سرویس فوروارد خودکار",
    description:
      "ارسال خودکار پیام‌ها از کانال‌های مبدا به کانال‌های مقصد با امکان ویرایش متن و استفاده از هوش مصنوعی",
  },
  {
    icon: <Copy className="h-8 w-8" />,
    title: "سرویس کپی کانال",
    description:
      "کپی تمامی پست‌های یک کانال تلگرامی به کانال دیگر با حفظ ساختار و فرمت پیام‌ها",
  },
];

export default function FeaturesSection() {
  const controls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [controls, isInView]);

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <section className="py-16 md:py-24 bg-secondary/30" ref={ref}>
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">سرویس‌های ما</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            خدمات ما با ویژگی‌های منحصر به فرد، تجربه استفاده از تلگرام را برای
            شما متحول می‌کند
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate={controls}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md transition-shadow"
              variants={itemVariants}
            >
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4 text-primary">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
