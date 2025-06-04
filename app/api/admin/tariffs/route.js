// app/api/admin/tariffs/route.js
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
// The following import is problematic as Next.js API routes do not directly access server/config
// import { JWT_SECRET } from "@/server/config"; // REMOVE THIS LINE

export const dynamic = "force-dynamic";

// Define the base URL for your Express server.
// It's crucial that this matches where your Express server is actually running.
// For development, it's typically localhost:3332. For production, it should be the internal IP or service name if in the same network, or the external URL if it's separate.
// Given your provided logs, the Express server is running on 3332.
const EXPRESS_SERVER_BASE_URL = `http://localhost:3332`; // Use 0.0.0.0 if in Docker/containerized environment

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
    console.error("Next.js API (PUT /api/admin/tariffs) error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}