export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await getAuthContext();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const state = searchParams.get("state");
    const search = searchParams.get("search");
    const groupBy = searchParams.get("groupBy");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status && status !== "all") where.status = status;
    if (state && state !== "all") where.state = state;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { ownerName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    if (groupBy === "state" || groupBy === "rating" || groupBy === "status") {
      const orderBy = groupBy === "state"
        ? [{ state: "asc" as const }, { city: "asc" as const }, { name: "asc" as const }]
        : groupBy === "rating"
        ? [{ rating: "desc" as const }, { name: "asc" as const }]
        : [{ status: "asc" as const }, { name: "asc" as const }];
      const records = await prisma.gymDatabase.findMany({ where, orderBy });
      const total = records.length;
      return NextResponse.json({ records, total, page: 1, limit: total, grouped: true });
    }

    const [records, total] = await Promise.all([
      prisma.gymDatabase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.gymDatabase.count({ where }),
    ]);

    return NextResponse.json({ records, total, page, limit });
  } catch (error) {
    console.error("Database GET error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthContext();
    const body = await request.json();

    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        const record = await prisma.gymDatabase.upsert({
          where: { googlePlaceId: item.googlePlaceId || `manual-${Date.now()}-${Math.random()}` },
          update: {
            name: item.name,
            ownerName: item.ownerName,
            email: item.email,
            phone: item.phone,
            website: item.website,
            address: item.address,
            city: item.city,
            state: item.state,
            zip: item.zip,
            rating: item.rating,
            reviewCount: item.reviewCount,
            categories: item.categories,
            socialMedia: item.socialMedia,
            source: item.source || "google_maps",
            updatedAt: new Date(),
          },
          create: {
            name: item.name,
            ownerName: item.ownerName,
            email: item.email,
            phone: item.phone,
            website: item.website,
            address: item.address,
            city: item.city,
            state: item.state,
            zip: item.zip,
            rating: item.rating,
            reviewCount: item.reviewCount,
            categories: item.categories,
            socialMedia: item.socialMedia,
            source: item.source || "google_maps",
            googlePlaceId: item.googlePlaceId,
          },
        });
        results.push(record);
      }
      return NextResponse.json({ data: results, count: results.length }, { status: 201 });
    }

    const record = await prisma.gymDatabase.create({ data: body });
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("Database POST error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await getAuthContext();
    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    fields.updatedAt = new Date();
    const record = await prisma.gymDatabase.update({ where: { id }, data: fields });
    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("Database PATCH error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await getAuthContext();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.gymDatabase.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
