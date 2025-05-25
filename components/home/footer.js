import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Instagram, 
  Twitter, 
  Linkedin 
} from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-secondary/30 pt-16 pb-6">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-4">تلگرام سرویس</h3>
            <p className="text-muted-foreground mb-4">
              ارائه دهنده خدمات حرفه‌ای تلگرام برای کاربران و کسب‌وکارها. با ما تجربه بهتری از تلگرام داشته باشید.
            </p>
            <div className="flex space-x-3 space-x-reverse">
              <Button variant="outline" size="icon" asChild>
                <Link href="#">
                  <Facebook className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="icon" asChild>
                <Link href="#">
                  <Instagram className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="icon" asChild>
                <Link href="#">
                  <Twitter className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="icon" asChild>
                <Link href="#">
                  <Linkedin className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">دسترسی سریع</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  صفحه اصلی
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  درباره ما
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-muted-foreground hover:text-primary transition-colors">
                  خدمات
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-muted-foreground hover:text-primary transition-colors">
                  تعرفه‌ها
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  تماس با ما
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">اطلاعات تماس</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <span className="text-muted-foreground">تهران، خیابان ولیعصر، برج آسمان</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary shrink-0" />
                <span className="text-muted-foreground">۰۲۱-۱۲۳۴۵۶۷۸</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary shrink-0" />
                <span className="text-muted-foreground">info@telegramservice.ir</span>
              </li>
            </ul>
          </div>
          
          {/* Newsletter */}
          <div>
            <h3 className="text-lg font-semibold mb-4">خبرنامه</h3>
            <p className="text-muted-foreground mb-4">
              برای دریافت آخرین اخبار و به‌روزرسانی‌ها، در خبرنامه ما عضو شوید.
            </p>
            <div className="flex gap-2">
              <Input type="email" placeholder="ایمیل خود را وارد کنید" />
              <Button>عضویت</Button>
            </div>
          </div>
        </div>
        
        <Separator className="mb-6" />
        
        <div className="text-center text-sm text-muted-foreground">
          <p>
            &copy; {currentYear} تلگرام سرویس. تمامی حقوق محفوظ است.
          </p>
        </div>
      </div>
    </footer>
  );
}