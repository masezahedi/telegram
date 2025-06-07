// app/api/admin/tariffs/route.js
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Use an environment variable for the Express server base URL
const EXPRESS_SERVER_BASE_URL = process.env.EXPRESS_SERVER_INTERNAL_URL || "http://localhost:3332";

export async function GET(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const expressResponse = await fetch(`${EXPRESS_SERVER_BASE_URL}/tariff-settings`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!expressResponse.ok) {
      const errorData = await expressResponse.json();
      return NextResponse.json(errorData, { status: expressResponse.status });
    }

    const data = await expressResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Next.js API (GET /api/admin/tariffs) error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const requestBody = await request.json();

    const expressResponse = await fetch(`${EXPRESS_SERVER_BASE_URL}/tariff-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!expressResponse.ok) {
      const errorData = await expressResponse.json();
      return NextResponse.json(errorData, { status: expressResponse.status });
    }

    const data = await expressResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Next.js API (PUT /api/admin/tariffs) error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}