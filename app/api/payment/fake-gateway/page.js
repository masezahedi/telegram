"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function FakeGatewayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authority = searchParams.get("authority");

  const handleFakePayment = async () => {
    if (!authority) {
      toast.error("خطا: کد تراکنش یافت نشد.");
      return;
    }

    // Redirect to callback URL, simulating a successful payment
    const callbackUrl = `/api/payment/callback?authority=${authority}&Status=OK`;
    router.push(callbackUrl);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">درگاه پرداخت تستی</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p>این یک درگاه پرداخت برای تست است.</p>
          <p>
            کد تراکنش:{" "}
            <span className="font-mono bg-gray-200 p-1 rounded">
              {authority}
            </span>
          </p>
          <Button onClick={handleFakePayment} size="lg" className="w-full">
            پرداخت موفق
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
