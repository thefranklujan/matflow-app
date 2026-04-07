export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";

export async function POST() {
  try {
    await requireAdmin();
    const c = await cookies();
    c.set("view_as_student", "1", { httpOnly: true, path: "/", sameSite: "lax" });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function DELETE() {
  const c = await cookies();
  c.delete("view_as_student");
  return NextResponse.json({ success: true });
}
