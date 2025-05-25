"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { SendHorizonal, MessageCircle, Sparkles } from 'lucide-react';

export default function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <section className="py-20 md:py-28 overflow-hidden relative">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background pointer-events-none" />
      
      <div className="container relative">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Content */}
          <motion.div 
            className="flex-1 text-center lg:text-right"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              سرویس‌های حرفه‌ای
              <span className="text-primary block md:inline"> تلگرام </span>
              برای شما
            </motion.h1>
            
            <motion.p 
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              با استفاده از سرویس‌های ما، تجربه کاربری خود را در تلگرام به سطح جدیدی ارتقا دهید.
              امکانات پیشرفته و کاربردی برای تمام نیازهای شما در تلگرام.
            </motion.p>
            
            <motion.div 
              className="flex flex-wrap gap-4 justify-center lg:justify-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  شروع کنید <SendHorizonal className="h-4 w-4" />
                </Button>
              </Link>
              
              <Link href="/services">
                <Button variant="outline" size="lg" className="gap-2">
                  مشاهده خدمات <MessageCircle className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
          
          {/* Image */}
          <motion.div 
            className="flex-1 relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <div className="relative w-full h-[400px] md:h-[500px]">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl transform rotate-3 scale-95" />
              <Image
                src="https://images.pexels.com/photos/7516347/pexels-photo-7516347.jpeg"
                alt="Telegram Services"
                fill
                priority
                className="object-cover rounded-2xl shadow-xl"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              
              {/* Feature badges */}
              <motion.div 
                className="absolute top-6 left-6 bg-white/90 dark:bg-black/90 p-3 rounded-lg shadow-lg flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
              >
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">پشتیبانی ۲۴ ساعته</span>
              </motion.div>
              
              <motion.div 
                className="absolute bottom-6 right-6 bg-white/90 dark:bg-black/90 p-3 rounded-lg shadow-lg flex items-center gap-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1 }}
              >
                <MessageCircle className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">ارسال خودکار پیام</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}