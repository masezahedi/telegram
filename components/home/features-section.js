"use client";

import { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { 
  MessageCircle, 
  Users, 
  BarChart, 
  Bot, 
  Shield, 
  Zap
} from 'lucide-react';

const features = [
  {
    icon: <MessageCircle className="h-8 w-8" />,
    title: 'ارسال خودکار پیام',
    description: 'ارسال پیام های خودکار به کاربران یا گروه های مورد نظر در زمان های مشخص',
  },
  {
    icon: <Users className="h-8 w-8" />,
    title: 'مدیریت گروه ها',
    description: 'امکان مدیریت حرفه ای گروه ها با قابلیت های پیشرفته و کاربردی',
  },
  {
    icon: <BarChart className="h-8 w-8" />,
    title: 'آمار و تحلیل',
    description: 'دریافت آمار دقیق و تحلیل های کاربردی از فعالیت های تلگرامی',
  },
  {
    icon: <Bot className="h-8 w-8" />,
    title: 'ربات های هوشمند',
    description: 'استفاده از ربات های هوشمند برای انجام امور مختلف به صورت خودکار',
  },
  {
    icon: <Shield className="h-8 w-8" />,
    title: 'امنیت بالا',
    description: 'امنیت بالا در استفاده از سرویس ها با رمزنگاری پیشرفته',
  },
  {
    icon: <Zap className="h-8 w-8" />,
    title: 'سرعت بالا',
    description: 'انجام عملیات با سرعت بالا و بدون محدودیت',
  },
];

export default function FeaturesSection() {
  const controls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  
  useEffect(() => {
    if (isInView) {
      controls.start('visible');
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">ویژگی‌های برتر ما</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            خدمات ما با ویژگی‌های منحصر به فرد، تجربه استفاده از تلگرام را برای شما متحول می‌کند
          </p>
        </div>
        
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
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