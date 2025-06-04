// app/api/admin/tariffs/route.js
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth"; //
import { JWT_SECRET } from "@/server/config"; // Import JWT_SECRET from server config
export const dynamic = "force-dynamic"; //

const EXPRESS_SERVER_BASE_URL = `http://localhost:${process.env.PORT || 3332}`; // Or use the production URL if deployed

export async function GET(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1]; //
    const decoded = await verifyToken(token); //

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ); //
    }

    // Forward the request to the Express server
    const expressResponse = await fetch(`${EXPRESS_SERVER_BASE_URL}/tariff-settings`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, // Pass the token to the Express server
      },
    });

    if (!expressResponse.ok) {
      const errorData = await expressResponse.json();
      return NextResponse.json(errorData, { status: expressResponse.status });
    }

    const data = await expressResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Next.js API (GET /api/admin/tariffs) error:", error); //
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    ); //
  }
}

export async function PUT(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1]; //
    const decoded = await verifyToken(token); //

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ); //
    }

    const requestBody = await request.json();

    // Forward the request to the Express server
    const expressResponse = await fetch(`${EXPRESS_SERVER_BASE_URL}/tariff-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, // Pass the token to the Express server
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
    console.error("Next.js API (PUT /api/admin/tariffs) error:", error); //
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    ); //
  }
}