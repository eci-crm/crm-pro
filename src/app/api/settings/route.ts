import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const settings = await db.setting.findMany();

    // Return as key-value object
    const settingsMap: Record<string, string> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settings: { key: string; value: string }[] = body;

    if (!Array.isArray(settings)) {
      return NextResponse.json(
        { error: "Settings must be an array of {key, value} objects" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      settings.map(async (setting) => {
        const { key, value } = setting;
        if (!key || typeof key !== "string") {
          return null;
        }

        return db.setting.upsert({
          where: { key },
          update: { value: value || "" },
          create: { key, value: value || "" },
        });
      })
    );

    const validResults = results.filter(Boolean);
    return NextResponse.json(validResults);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const settings: { key: string; value: string }[] = body;

    if (!Array.isArray(settings)) {
      return NextResponse.json(
        { error: "Settings must be an array of {key, value} objects" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      settings.map(async (setting) => {
        const { key, value } = setting;
        if (!key || typeof key !== "string") {
          return null;
        }

        return db.setting.upsert({
          where: { key },
          update: { value: value || "" },
          create: { key, value: value || "" },
        });
      })
    );

    const validResults = results.filter(Boolean);
    return NextResponse.json(validResults);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
