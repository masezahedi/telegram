import { GET_DB } from "@/lib/db";
import { NextResponse } from "next/server";
import { add } from "date-fns";

async function upgradeUserAccount(db, userId, tariffId) {
  const tariff = await db.get("SELECT * FROM tariffs WHERE id = ?", tariffId);
  if (!tariff) throw new Error("Tariff not found for upgrade");

  const expiryDate = add(new Date(), { days: tariff.duration_days });

  await db.run(
    "UPDATE users SET tariff_id = ?, tariff_expiry = ? WHERE id = ?",
    [tariffId, expiryDate.toISOString(), userId]
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const authority = searchParams.get("authority");
  const status = searchParams.get("Status");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!authority) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?payment=failed&reason=no_authority`
    );
  }

  const db = await GET_DB();
  const payment = await db.get(
    "SELECT * FROM payments WHERE authority = ?",
    authority
  );

  if (!payment) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?payment=failed&reason=not_found`
    );
  }

  if (payment.status !== "PENDING") {
    return NextResponse.redirect(
      `${appUrl}/dashboard?payment=already_processed`
    );
  }

  if (status !== "OK") {
    await db.run("UPDATE payments SET status = ? WHERE id = ?", [
      "FAILED",
      payment.id,
    ]);
    return NextResponse.redirect(
      `${appUrl}/dashboard?payment=failed&reason=user_cancelled`
    );
  }

  // Handle Fake Gateway
  if (payment.amount === 0) {
    try {
      await upgradeUserAccount(db, payment.user_id, payment.tariff_id);
      await db.run("UPDATE payments SET status = ?, ref_id = ? WHERE id = ?", [
        "SUCCESS",
        "FAKE_GATEWAY",
        payment.id,
      ]);
      return NextResponse.redirect(`${appUrl}/dashboard?payment=success`);
    } catch (error) {
      console.error("Error upgrading user (fake gateway):", error);
      return NextResponse.redirect(
        `${appUrl}/dashboard?payment=failed&reason=upgrade_error`
      );
    }
  }

  // Handle Zarinpal Verification
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  try {
    const verifyResponse = await fetch(
      "https://api.zarinpal.com/pg/v4/payment/verify.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          amount: payment.amount,
          authority: authority,
        }),
      }
    );

    const verifyData = await verifyResponse.json();

    if (verifyData.data && verifyData.data.code === 100) {
      // Success
      await upgradeUserAccount(db, payment.user_id, payment.tariff_id);
      await db.run("UPDATE payments SET status = ?, ref_id = ? WHERE id = ?", [
        "SUCCESS",
        verifyData.data.ref_id,
        payment.id,
      ]);
      return NextResponse.redirect(`${appUrl}/dashboard?payment=success`);
    } else if (verifyData.data && verifyData.data.code === 101) {
      // Already verified
      return NextResponse.redirect(
        `${appUrl}/dashboard?payment=already_processed`
      );
    } else {
      // Verification failed
      await db.run("UPDATE payments SET status = ? WHERE id = ?", [
        "FAILED",
        payment.id,
      ]);
      const errorCode = verifyData.errors.code || "نامشخص";
      return NextResponse.redirect(
        `${appUrl}/dashboard?payment=failed&reason=verify_failed&code=${errorCode}`
      );
    }
  } catch (error) {
    console.error("Zarinpal verification error:", error);
    return NextResponse.redirect(
      `${appUrl}/dashboard?payment=failed&reason=internal_error`
    );
  }
}
