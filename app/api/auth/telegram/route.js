import { NextResponse } from "next/server";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { openDb } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
const BOT_TOKEN =
  process.env.BOT_TOKEN || "7592946651:AAF9k8_vdXc2BKMqZZEgK9djE8ef-mjl0PI";

export default function TelegramAuth() {
  const router = useRouter();
  const [status, setStatus] = useState("در حال اعتبارسنجی...");

  useEffect(() => {
    const authenticate = async (tg) => {
      // tg را به عنوان پارامتر دریافت می‌کند
      if (!tg.initData) {
        setStatus(
          "خطا: اطلاعات تلگرام یافت نشد. لطفاً از طریق اپلیکیشن تلگرام وارد شوید."
        );
        toast.error("لطفاً این صفحه را از طریق ربات تلگرام باز کنید.");
        setTimeout(() => router.replace("/login"), 3000);
        return;
      }

      try {
        const result = await AuthService.telegramLogin(tg.initData);
        if (result.success) {
          setStatus("اعتبارسنجی موفق! در حال انتقال به داشبورد...");
          toast.success("با موفقیت وارد شدید!");
          router.replace("/dashboard");
        } else {
          setStatus(`خطا در اعتبارسنجی: ${result.message}`);
          toast.error(result.message || "خطا در ورود از طریق تلگرام.");
        }
      } catch (error) {
        console.error("Auth error:", error);
        setStatus("خطای غیرمنتظره در سرور.");
        toast.error("خطای غیرمنتظره در سرور.");
      }
    };

    // بررسی وجود آبجکت تلگرام
    if (typeof window.Telegram?.WebApp !== "undefined") {
      const tg = window.Telegram.WebApp;
      // منتظر می‌مانیم تا وب‌اپ تلگرام آماده شود
      tg.ready();
      // سپس فرآیند احراز هویت را شروع می‌کنیم
      authenticate(tg);
    } else {
      // اگر آبجکت تلگرام حتی پس از بارگذاری اولیه وجود نداشت
      setStatus("خطا در بارگذاری اسکریپت تلگرام. لطفاً صفحه را رفرش کنید.");
      toast.error(
        "اسکریپت تلگرام بارگذاری نشد. لطفاً از داخل اپلیکیشن تلگرام اقدام کنید."
      );
      setTimeout(() => router.replace("/login"), 5000);
    }
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="h-10 w-10 rounded-full border-4 border-primary border-r-transparent animate-spin mb-4"></div>
      <h1 className="text-xl font-semibold mb-2">ورود از طریق تلگرام</h1>
      <p className="text-muted-foreground">{status}</p>
    </div>
  );
}

export async function POST(request) {
  try {
    const { initData } = await request.json();

    if (!initData) {
      return NextResponse.json(
        { error: "initData is required" },
        { status: 400 }
      );
    }

    const isValid = await verifyTelegramAuth(initData);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid data from Telegram" },
        { status: 403 }
      );
    }

    const urlParams = new URLSearchParams(initData);
    const userObject = JSON.parse(urlParams.get("user"));

    if (!userObject || !userObject.id) {
      return NextResponse.json({ error: "Invalid user data" }, { status: 400 });
    }

    const db = await openDb();

    let user = await db.get("SELECT * FROM users WHERE telegram_id = ?", [
      userObject.id,
    ]);

    if (!user) {
      const newUserId = Date.now().toString();
      const name = `${userObject.first_name || ""} ${
        userObject.last_name || ""
      }`.trim();

      await db.run(
        "INSERT INTO users (id, name, telegram_id, email, password) VALUES (?, ?, ?, ?, ?)",
        [
          newUserId,
          name || userObject.username || "کاربر تلگرام",
          userObject.id,
          null,
          null,
        ]
      );
      user = await db.get("SELECT * FROM users WHERE id = ?", [newUserId]);
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    const tariffSettings = await db.get(
      "SELECT * FROM tariff_settings LIMIT 1"
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        telegram_id: user.telegram_id,
        has_password: !!user.password,
        telegram_session: user.telegram_session,
        is_admin: Boolean(user.is_admin),
        is_premium: Boolean(user.is_premium),
        premium_expiry_date: user.premium_expiry_date,
        trial_activated_at: user.trial_activated_at,
        tariffSettings: tariffSettings,
      },
    });
  } catch (error) {
    console.error("Telegram auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
