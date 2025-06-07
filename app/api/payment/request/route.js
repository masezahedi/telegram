import { GET_DB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(request) {
  const session = await getSession(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tariffId } = await request.json();
  if (!tariffId) {
    return NextResponse.json(
      { error: "Tariff ID is required" },
      { status: 400 }
    );
  }

  const db = await GET_DB();
  const tariff = await db.get("SELECT * FROM tariffs WHERE id = ?", tariffId);
  if (!tariff) {
    return NextResponse.json({ error: "Tariff not found" }, { status: 404 });
  }

  const amount = tariff.price;
  const authority = uuidv4(); // Unique ID for this payment

  // Store payment record
  await db.run(
    "INSERT INTO payments (user_id, tariff_id, amount, authority, status) VALUES (?, ?, ?, ?, ?)",
    [session.user.id, tariff.id, amount, authority, "PENDING"]
  );

  // Fake Gateway for testing (price is 0)
  if (amount === 0) {
    const redirectUrl = `/payment/fake-gateway?authority=${authority}`;
    return NextResponse.json({ redirectUrl });
  }

  // Zarinpal Gateway
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/callback`;
  const description = `خرید اشتراک ${tariff.name}`;

  try {
    const zarinpalResponse = await fetch(
      "https://api.zarinpal.com/pg/v4/payment/request.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          amount: amount,
          description: description,
          callback_url: callbackUrl,
          metadata: {
            email: session.user.email,
            mobile: session.user.phone || "",
          },
        }),
      }
    );

    const zarinpalData = await zarinpalResponse.json();

    if (zarinpalData.data && zarinpalData.data.authority) {
      // Update our payment record with Zarinpal's authority
      await db.run("UPDATE payments SET authority = ? WHERE authority = ?", [
        zarinpalData.data.authority,
        authority,
      ]);

      const redirectUrl = `https://www.zarinpal.com/pg/StartPay/${zarinpalData.data.authority}`;
      return NextResponse.json({ redirectUrl });
    } else {
      await db.run("UPDATE payments SET status = ? WHERE authority = ?", [
        "FAILED",
        authority,
      ]);
      const errorCode = zarinpalData.errors.code || "نامشخص";
      return NextResponse.json(
        { error: `خطا در اتصال به درگاه پرداخت. کد خطا: ${errorCode}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Zarinpal request error:", error);
    await db.run("UPDATE payments SET status = ? WHERE authority = ?", [
      "FAILED",
      authority,
    ]);
    return NextResponse.json(
      { error: "خطای داخلی سرور در ارتباط با درگاه پرداخت" },
      { status: 500 }
    );
  }
}
