import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Frank from MatFlow <frank@mymatflow.com>";

async function send(to: string, subject: string, html: string, bccFrank = false) {
  if (!resend) {
    console.log(`[Email] Would send to ${to}: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      ...(bccFrank ? { bcc: "franklujan@gmail.com" } : {}),
    });
  } catch (err) {
    console.error("[Email] Failed:", err);
  }
}

// Brand-conformant email shell: black bg, white text, red (#dc2626) accents.
// Every email body must go through this wrapper. Don't ship raw HTML.
function wrap({
  eyebrow,
  headline,
  body,
  ctaText,
  ctaHref,
  footnote,
}: {
  eyebrow?: string;
  headline: string;
  body: string;
  ctaText?: string;
  ctaHref?: string;
  footnote?: string;
}) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MatFlow</title></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
  <tr><td style="padding:28px 32px 20px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;padding-right:14px;">
        <table cellpadding="0" cellspacing="0" style="background:#dc2626;border-radius:8px;width:42px;height:42px;"><tr><td align="center" valign="middle" style="padding:9px 7px;">
          <div style="width:28px;height:5px;background:#ffffff;border-radius:1px;margin-bottom:3px;"></div>
          <div style="width:18px;height:5px;background:#ffffff;border-radius:1px;margin-bottom:3px;"></div>
          <div style="width:28px;height:5px;background:#ffffff;border-radius:1px;"></div>
        </td></tr></table>
      </td>
      <td style="vertical-align:middle;">
        <div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1;">MatFlow</div>
        <table cellpadding="0" cellspacing="0" style="margin-top:5px;border-collapse:collapse;border:1px solid rgba(255,255,255,0.4);"><tr>
          <td style="width:18px;height:6px;background:#ffffff;"></td>
          <td style="width:18px;height:6px;background:#2563eb;"></td>
          <td style="width:18px;height:6px;background:#7c3aed;"></td>
          <td style="width:18px;height:6px;background:#92400e;"></td>
          <td style="width:18px;height:6px;background:#000000;"></td>
        </tr></table>
        ${eyebrow ? `<div style="font-size:10px;font-weight:700;color:#dc2626;letter-spacing:1.5px;text-transform:uppercase;margin-top:6px;">${eyebrow}</div>` : ""}
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:36px 32px 8px 32px;">
    <h1 style="margin:0 0 16px 0;font-size:28px;line-height:1.2;color:#ffffff;font-weight:800;letter-spacing:-0.5px;">${headline}</h1>
    <div style="font-size:15px;line-height:1.6;color:#a3a3a3;">${body}</div>
  </td></tr>

  ${ctaText && ctaHref ? `
  <tr><td style="padding:28px 32px 8px 32px;" align="left">
    <a href="${ctaHref}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;">${ctaText}</a>
  </td></tr>` : ""}

  ${footnote ? `<tr><td style="padding:24px 32px 8px 32px;"><div style="font-size:13px;color:#737373;">${footnote}</div></td></tr>` : ""}

  <tr><td style="padding:32px 32px 24px 32px;border-top:1px solid rgba(255,255,255,0.06);margin-top:24px;">
    <div style="font-size:11px;color:#525252;line-height:1.6;text-align:center;">
      MatFlow &middot; The training companion built for jiu-jitsu
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function sendWelcomeEmail(email: string, name: string, gymName: string) {
  const html = wrap({
    eyebrow: "Welcome",
    headline: `Welcome to ${gymName}.`,
    body: `<p style="margin:0 0 12px 0;">Hey ${name},</p>
           <p style="margin:0 0 12px 0;">Your account on MatFlow is ready. You can now view the class schedule, track belt progression, shop the pro shop, and check your attendance history.</p>
           <p style="margin:0;">See you on the mats.</p>`,
    ctaText: "Open MatFlow",
    ctaHref: "https://app.mymatflow.com",
  });
  send(email, `Welcome to ${gymName}`, html).catch(() => {});
}

export function sendOrderConfirmation(
  email: string,
  name: string,
  orderId: string,
  total: number,
  gymName: string
) {
  const orderNum = orderId.slice(-8).toUpperCase();
  const html = wrap({
    eyebrow: "Order Confirmed",
    headline: `Order #${orderNum}`,
    body: `<p style="margin:0 0 12px 0;">Hey ${name},</p>
           <p style="margin:0 0 16px 0;">Your order has been placed.</p>
           <p style="margin:0 0 16px 0;font-size:32px;font-weight:800;color:#ffffff;">$${total.toFixed(2)}</p>
           <p style="margin:0;">Payment will be collected at pickup or by arrangement. Contact your gym for details.</p>`,
    footnote: gymName,
  });
  send(email, `Order Confirmed #${orderNum}`, html).catch(() => {});
}

export function sendBeltPromotion(
  email: string,
  name: string,
  newBelt: string,
  stripes: number,
  gymName: string
) {
  const html = wrap({
    eyebrow: "Promotion",
    headline: `Congratulations, ${name}.`,
    body: `<p style="margin:0 0 16px 0;">You have been promoted to</p>
           <p style="margin:0 0 16px 0;font-size:38px;font-weight:900;color:#ffffff;text-transform:uppercase;letter-spacing:-1px;">${newBelt} Belt${stripes > 0 ? ` <span style="color:#dc2626;">(${stripes} stripe${stripes > 1 ? "s" : ""})</span>` : ""}</p>
           <p style="margin:0;">Your hard work and dedication on the mats has paid off. Keep training.</p>`,
    footnote: gymName,
  });
  send(email, `Belt Promotion: ${newBelt} Belt`, html).catch(() => {});
}

export function sendTrialExpiring(email: string, name: string, daysLeft: number) {
  const html = wrap({
    eyebrow: "Trial Ending",
    headline: `Your trial ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}.`,
    body: `<p style="margin:0 0 12px 0;">Hey ${name},</p>
           <p style="margin:0;">Your MatFlow free trial is ending soon. Subscribe now to keep managing your gym with MatFlow.</p>`,
    ctaText: "Choose a Plan",
    ctaHref: "https://app.mymatflow.com/admin/billing",
  });
  send(email, `Your MatFlow trial ends in ${daysLeft} days`, html).catch(() => {});
}

export function sendClassReminder(
  email: string,
  name: string,
  classType: string,
  time: string,
  gymName: string
) {
  const html = wrap({
    eyebrow: "Class Today",
    headline: `${classType} today at ${time}.`,
    body: `<p style="margin:0 0 12px 0;">Hey ${name},</p>
           <p style="margin:0;">See you on the mats.</p>`,
    footnote: gymName,
  });
  send(email, `Reminder: ${classType} today at ${time}`, html).catch(() => {});
}

export function sendJoinRequestSubmittedToAdmin(email: string, studentName: string, gymName: string) {
  const html = wrap({
    eyebrow: "New Request",
    headline: "New join request.",
    body: `<p style="margin:0;"><strong style="color:#ffffff;">${studentName}</strong> has requested to join <strong style="color:#ffffff;">${gymName}</strong> on MatFlow.</p>`,
    ctaText: "Review Request",
    ctaHref: "https://app.mymatflow.com/app/requests",
    footnote: gymName,
  });
  send(email, `New join request from ${studentName}`, html).catch(() => {});
}

export function sendJoinRequestApprovedToStudent(email: string, studentName: string, gymName: string) {
  const html = wrap({
    eyebrow: "Approved",
    headline: "You are in.",
    body: `<p style="margin:0 0 12px 0;">Hey ${studentName},</p>
           <p style="margin:0 0 12px 0;">Your request to join <strong style="color:#ffffff;">${gymName}</strong> has been approved. You now have full access to the schedule, attendance, belt progression, videos, and more.</p>
           <p style="margin:0;">See you on the mats.</p>`,
    ctaText: "Open MatFlow",
    ctaHref: "https://app.mymatflow.com/student",
  });
  send(email, `You are approved at ${gymName}`, html).catch(() => {});
}

export function notifyFrankNewGymPending({ gymName, ownerName, ownerEmail }: { gymName: string; ownerName: string; ownerEmail: string }) {
  const html = wrap({
    eyebrow: "New Gym Signup",
    headline: "A gym is waiting for approval.",
    body: `<table cellpadding="6" style="font-size:14px;color:#a3a3a3;">
             <tr><td><strong style="color:#ffffff;">Gym</strong></td><td>${gymName}</td></tr>
             <tr><td><strong style="color:#ffffff;">Owner</strong></td><td>${ownerName}</td></tr>
             <tr><td><strong style="color:#ffffff;">Email</strong></td><td>${ownerEmail}</td></tr>
             <tr><td><strong style="color:#ffffff;">When</strong></td><td>${new Date().toLocaleString()}</td></tr>
           </table>`,
    ctaText: "Review and Approve",
    ctaHref: "https://app.mymatflow.com/platform/approve-gyms",
  });
  send("franklujan@gmail.com", `New Gym Pending: ${gymName}`, html).catch(() => {});
}

export function notifyAdminOfNewStudent(student: { firstName: string; lastName: string; email: string; phone?: string | null }) {
  const html = wrap({
    eyebrow: "Internal",
    headline: "New MatFlow Student",
    body: `<table cellpadding="6" style="font-size:14px;color:#a3a3a3;">
             <tr><td><strong style="color:#ffffff;">Name</strong></td><td>${student.firstName} ${student.lastName}</td></tr>
             <tr><td><strong style="color:#ffffff;">Email</strong></td><td>${student.email}</td></tr>
             <tr><td><strong style="color:#ffffff;">Phone</strong></td><td>${student.phone || "&mdash;"}</td></tr>
             <tr><td><strong style="color:#ffffff;">When</strong></td><td>${new Date().toLocaleString()}</td></tr>
           </table>`,
  });
  send("franklujan@gmail.com", `New MatFlow Student: ${student.firstName} ${student.lastName}`, html).catch(() => {});
}

export function sendWeeklyRecap(
  email: string,
  name: string,
  data: {
    sessionsThisWeek: number;
    hoursThisWeek: number;
    currentStreak: number;
    leaderboardRank: number;
    topPartner?: string | null;
  }
) {
  const { sessionsThisWeek, hoursThisWeek, currentStreak, leaderboardRank, topPartner } = data;

  let message = "";
  if (sessionsThisWeek === 0) {
    message = "Zero sessions this week. The mats are open. Get back on them.";
  } else if (sessionsThisWeek <= 2) {
    message = `${sessionsThisWeek} session${sessionsThisWeek === 1 ? "" : "s"} on the books. Add one more next week and watch what happens.`;
  } else if (sessionsThisWeek <= 4) {
    message = `${sessionsThisWeek} sessions this week. That is the rhythm of someone who is getting better every month.`;
  } else {
    message = `${sessionsThisWeek} sessions this week. Elite work. Recover hard, then go again.`;
  }

  const stat = (label: string, value: string) => `
    <td style="background:#000000;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 12px;text-align:center;">
      <div style="font-size:24px;font-weight:900;color:#ffffff;line-height:1;">${value}</div>
      <div style="font-size:10px;color:#737373;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-top:6px;">${label}</div>
    </td>`;

  const html = wrap({
    eyebrow: "Weekly Recap",
    headline: "Your week on the mats.",
    body: `<p style="margin:0 0 18px 0;">Hey ${name},</p>
           <p style="margin:0 0 22px 0;">Here is the week behind you.</p>
           <table cellpadding="0" cellspacing="6" style="width:100%;border-collapse:separate;">
             <tr>
               ${stat("Sessions", String(sessionsThisWeek))}
               ${stat("Hours", String(hoursThisWeek))}
             </tr>
             <tr>
               ${stat("Streak", `${currentStreak}d`)}
               ${stat("Rank", `#${leaderboardRank}`)}
             </tr>
           </table>
           ${topPartner ? `<p style="margin:18px 0 0 0;font-size:13px;color:#a3a3a3;">Most rolled with: <strong style="color:#ffffff;">${topPartner}</strong></p>` : ""}
           <p style="margin:22px 0 0 0;color:#ffffff;font-weight:600;">${message}</p>`,
    ctaText: "Open MatFlow",
    ctaHref: "https://app.mymatflow.com/student",
    footnote: "Recaps land every Sunday night. Stay sharp.",
  });
  send(email, "Your week on the mats", html).catch(() => {});
}

export function sendGymApprovedEmail(email: string, ownerName: string, gymName: string) {
  const html = wrap({
    eyebrow: "Approved",
    headline: `Welcome to MatFlow, ${ownerName}.`,
    body: `<p style="margin:0 0 16px 0;">Your academy <strong style="color:#ffffff;">${gymName}</strong> has been approved and is now live on MatFlow.</p>
           <p style="margin:0 0 16px 0;">You now have full access to everything:</p>
           <table cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
             <tr><td style="padding:4px 0;color:#a3a3a3;font-size:14px;">&#10003; &nbsp;Class scheduling and attendance</td></tr>
             <tr><td style="padding:4px 0;color:#a3a3a3;font-size:14px;">&#10003; &nbsp;Belt and stripe progression tracking</td></tr>
             <tr><td style="padding:4px 0;color:#a3a3a3;font-size:14px;">&#10003; &nbsp;Kiosk check-in for your students</td></tr>
             <tr><td style="padding:4px 0;color:#a3a3a3;font-size:14px;">&#10003; &nbsp;Pro shop with inventory management</td></tr>
             <tr><td style="padding:4px 0;color:#a3a3a3;font-size:14px;">&#10003; &nbsp;Video library and digital waivers</td></tr>
             <tr><td style="padding:4px 0;color:#a3a3a3;font-size:14px;">&#10003; &nbsp;Analytics and member management</td></tr>
           </table>
           <p style="margin:0;">Log in and start setting up your academy. If you need anything, just reply to this email.</p>`,
    ctaText: "Open Your Dashboard",
    ctaHref: "https://app.mymatflow.com/app",
    footnote: "You are a founding member. Your pricing is locked in for life.",
  });
  send(email, `${gymName} is live on MatFlow`, html, true).catch(() => {});
}

export function sendJoinRequestRejectedToStudent(email: string, studentName: string, gymName: string) {
  const html = wrap({
    eyebrow: "Update",
    headline: "Update on your request.",
    body: `<p style="margin:0 0 12px 0;">Hey ${studentName},</p>
           <p style="margin:0 0 12px 0;">Your request to join <strong style="color:#ffffff;">${gymName}</strong> was not approved at this time. You can still reach out to the gym directly to learn more.</p>
           <p style="margin:0;">You can browse other gyms on MatFlow and request to join them.</p>`,
    ctaText: "Find Other Gyms",
    ctaHref: "https://app.mymatflow.com/student/gyms",
  });
  send(email, `Update from ${gymName}`, html).catch(() => {});
}
