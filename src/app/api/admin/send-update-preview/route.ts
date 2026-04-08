export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { Resend } from "resend";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "franklujan@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

const HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MatFlow — What's New</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
<div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">MatFlow</div>
<div style="font-size:11px;font-weight:600;color:#dc2626;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">Student Update</div>
</td></tr>
<tr><td style="padding:36px 32px 8px 32px;">
<h1 style="margin:0 0 12px 0;font-size:28px;line-height:1.2;color:#fff;font-weight:800;letter-spacing:-0.5px;">Your community just leveled up.</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#a3a3a3;">Five new ways to connect with your training partners, track your grind, and earn your spot on the mats.</p>
</td></tr>
<tr><td style="padding:28px 32px 0 32px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;"><tr>
<td width="56" valign="top" style="padding:20px 0 20px 20px;"><div style="width:40px;height:40px;border-radius:10px;background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.3);text-align:center;line-height:40px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></div></td>
<td valign="top" style="padding:18px 20px 18px 14px;"><div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">Likes on posts</div><div style="font-size:13px;line-height:1.5;color:#888;">Show love for your teammates' wins, technique drops, and roll recaps. One tap.</div></td>
</tr></table></td></tr>
<tr><td style="padding:12px 32px 0 32px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;"><tr>
<td width="56" valign="top" style="padding:20px 0 20px 20px;"><div style="width:40px;height:40px;border-radius:10px;background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.3);text-align:center;line-height:40px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div></td>
<td valign="top" style="padding:18px 20px 18px 14px;"><div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">Comment threads</div><div style="font-size:13px;line-height:1.5;color:#888;">Talk back. Ask questions. Trash talk before open mat. Every post now has a thread.</div></td>
</tr></table></td></tr>
<tr><td style="padding:12px 32px 0 32px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(220,38,38,0.12),rgba(255,165,0,0.06));border:1px solid rgba(220,38,38,0.25);border-radius:12px;"><tr>
<td width="56" valign="top" style="padding:20px 0 20px 20px;"><div style="width:40px;height:40px;border-radius:10px;background:rgba(220,38,38,0.18);border:1px solid rgba(220,38,38,0.4);text-align:center;line-height:40px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg></div></td>
<td valign="top" style="padding:18px 20px 18px 14px;"><div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">Group leaderboards</div><div style="font-size:13px;line-height:1.5;color:#ddd;">Top 5 grinders in your gym this month. Gold, silver, bronze. Earn your spot.</div></td>
</tr></table></td></tr>
<tr><td style="padding:12px 32px 0 32px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;"><tr>
<td width="56" valign="top" style="padding:20px 0 20px 20px;"><div style="width:40px;height:40px;border-radius:10px;background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.3);text-align:center;line-height:40px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></div></td>
<td valign="top" style="padding:18px 20px 18px 14px;"><div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">Training streaks</div><div style="font-size:13px;line-height:1.5;color:#888;">Log your sessions and watch your streak climb. Don't break the chain.</div></td>
</tr></table></td></tr>
<tr><td style="padding:12px 32px 0 32px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;"><tr>
<td width="56" valign="top" style="padding:20px 0 20px 20px;"><div style="width:40px;height:40px;border-radius:10px;background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.3);text-align:center;line-height:40px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg></div></td>
<td valign="top" style="padding:18px 20px 18px 14px;"><div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">Profile photos</div><div style="font-size:13px;line-height:1.5;color:#888;">Upload your face. Show up in posts, comments, the members list, and the leaderboard.</div></td>
</tr></table></td></tr>
<tr><td style="padding:32px 32px 8px 32px;" align="center"><a href="https://app.mymatflow.com/student" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;">Open MatFlow</a></td></tr>
<tr><td style="padding:8px 32px 32px 32px;" align="center"><div style="font-size:12px;color:#666;">Update your profile photo first &mdash; it'll show up everywhere.</div></td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);"><div style="font-size:11px;color:#555;line-height:1.6;text-align:center;">MatFlow &middot; The training companion built for jiu-jitsu<br>You're getting this because you have a MatFlow student account.</div></td></tr>
</table></td></tr></table></body></html>`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes((session.email || "").toLowerCase())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }

  const { to } = await req.json().catch(() => ({ to: "franklujan@gmail.com" }));
  const recipient = to || "franklujan@gmail.com";

  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const result = await resend.emails.send({
      from: "MatFlow <noreply@mymatflow.com>",
      to: recipient,
      subject: "MatFlow: Your community just leveled up",
      html: HTML,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
