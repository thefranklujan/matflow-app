import { NextResponse } from "next/server";
import { buildAcademyExport, exportFilename, ExportTooLargeError } from "@/lib/academy-export";
import { logActivity } from "@/lib/activity-log";

/**
 * Sensitive download: authenticated route only, never cached or shared via a
 * public URL, and nothing about its contents is logged (the activity log
 * records only that an export happened and its record counts).
 */
export async function academyExportResponse(gymId: string, actor: { id?: string; label: string }) {
  try {
    const data = await buildAcademyExport(gymId);
    if (!data) return NextResponse.json({ error: "Academy not found" }, { status: 404 });
    logActivity({ gymId, action: "data_exported", actorId: actor.id, actorName: actor.label, meta: data.manifest.counts });
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(data.academy.slug)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof ExportTooLargeError) {
      return NextResponse.json(
        { error: "This academy is too large for a self-serve export. Contact support for an assisted export.", code: "EXPORT_TOO_LARGE" },
        { status: 413 },
      );
    }
    console.error("[export] failed for gym", gymId);
    return NextResponse.json({ error: "Export failed. Nothing was changed; try again." }, { status: 500 });
  }
}
