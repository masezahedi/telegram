// app/api/payment/request/route.js
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Use an environment variable for the Express server base URL
const EXPRESS_SERVER_BASE_URL = process.env.EXPRESS_SERVER_INTERNAL_URL || "http://localhost:3332";

export async function POST(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { amount, description, callbackUrl } = await request.json();

    if (!amount || !description || !callbackUrl) {
      return NextResponse.json(
        { success: false, error: "اطلاعات پرداخت ناقص است." },
        { status: 400 }
      );
    }

    // Forward the request to your Express backend
    const expressResponse = await fetch(`${EXPRESS_SERVER_BASE_URL}/payment/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, // Pass the user's token
      },
      body: JSON.stringify({ amount, description, callbackUrl }),
    });

    const data = await expressResponse.json();
    return NextResponse.json(data, { status: expressResponse.status });

  } catch (error) {
    console.error("Next.js API (POST /api/payment/request) error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}