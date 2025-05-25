"use client";

import { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'framer-motion';
import Image from 'next/image';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'سارا احمدی',
    position: 'مدیر بازاریابی',
    company: 'تک‌استارت',
    content: 'استفاده از این سرویس باعث شد بتونم خیلی راحت‌تر کانال تلگرامم رو مدیریت کنم. واقعاً عالی و کاربردیه!',
    rating: 5,
    image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg',
  },
  {
    name: 'امیر حسینی',
    position: 'صاحب کسب و کار',
    company: 'دیجی‌پلاس',
    content: 'سرعت و کیفیت خدمات فوق‌العاده است. پشتیبانی عالی و تیم فنی قوی دارند. به همه پیشنهاد می‌کنم.',
    rating: 5,
    image: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg',
  },
  {
    name: 'نیلوفر کریمی',
    position: 'تولیدکننده محتوا',
    company: 'محتوا پلاس',
    content: 'من برای مدیریت گروه‌های تلگرامی از این سرویس استفاده می‌کنم و واقعاً راضی هستم. امکانات فوق‌العاده‌ای داره.',
    rating: 4,
    image: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg',
  },
];

export default function TestimonialsSection() {
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
        staggerChildren: 0.2,
      },
    },
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
      },
    },
  };

  return (
    <section className="py-16 md:py-24" ref={ref}>
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">نظرات کاربران ما</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            کاربران ما درباره تجربه استفاده از سرویس‌های ما چه می‌گویند
          </p>
        </div>
        
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate={controls}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              className="bg-card rounded-xl p-6 shadow border border-border overflow-hidden"
              variants={itemVariants}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-semibold">{testimonial.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.position}، {testimonial.company}
                  </p>
                </div>
              </div>
              
              <div className="flex mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < testimonial.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              
              <blockquote className="text-muted-foreground">
                "{testimonial.content}"
              </blockquote>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}