"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export default function UpgradeButton({ tariffId, children, ...props }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/payment/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tariffId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "خطا در شروع فرآیند پرداخت");
      }

      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        throw new Error("پاسخ نامعتبر از سرور");
      }
    } catch (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleUpgrade} disabled={loading} {...props}>
      <Sparkles className="ml-2 h-4 w-4" />
      {loading ? "در حال انتقال به درگاه..." : children}
    </Button>
  );
}
