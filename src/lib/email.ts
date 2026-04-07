import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "MatFlow <noreply@mymatflow.com>";

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[Email] Would send to ${to}: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[Email] Failed:", err);
  }
}

export function sendWelcomeEmail(email: string, name: string, gymName: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#c4b5a0;margin-bottom:8px;">Welcome to ${gymName}!</h1>
      <p>Hey ${name},</p>
      <p>Your account on MatFlow is ready. You can now:</p>
      <ul>
        <li>View the class schedule and commit to sessions</li>
        <li>Track your belt progression and techniques</li>
        <li>Shop the pro shop</li>
        <li>View your attendance history</li>
      </ul>
      <p>See you on the mats!</p>
      <p style="color:#888;font-size:12px;margin-top:32px;">Powered by MatFlow</p>
    </div>
  `;
  send(email, `Welcome to ${gymName}!`, html).catch(() => {});
}

export function sendOrderConfirmation(
  email: string,
  name: string,
  orderId: string,
  total: number,
  gymName: string
) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#c4b5a0;">Order Confirmed!</h1>
      <p>Hey ${name},</p>
      <p>Your order <strong>#${orderId.slice(-8).toUpperCase()}</strong> has been placed.</p>
      <p style="font-size:24px;font-weight:bold;color:#c4b5a0;">Total: $${total.toFixed(2)}</p>
      <p>Payment will be collected at pickup or by arrangement. Contact your gym for details.</p>
      <p style="color:#888;font-size:12px;margin-top:32px;">${gymName} . Powered by MatFlow</p>
    </div>
  `;
  send(email, `Order Confirmed #${orderId.slice(-8).toUpperCase()}`, html).catch(() => {});
}

export function sendBeltPromotion(
  email: string,
  name: string,
  newBelt: string,
  stripes: number,
  gymName: string
) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;text-align:center;">
      <h1 style="color:#c4b5a0;">Congratulations, ${name}!</h1>
      <p style="font-size:20px;">You have been promoted to</p>
      <p style="font-size:32px;font-weight:bold;text-transform:uppercase;">${newBelt} Belt${stripes > 0 ? ` (${stripes} stripe${stripes > 1 ? "s" : ""})` : ""}</p>
      <p>Your hard work and dedication on the mats has paid off. Keep training!</p>
      <p style="color:#888;font-size:12px;margin-top:32px;">${gymName} . Powered by MatFlow</p>
    </div>
  `;
  send(email, `Belt Promotion: ${newBelt} Belt!`, html).catch(() => {});
}

export function sendTrialExpiring(email: string, name: string, daysLeft: number) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#FF6B35;">Your trial ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}</h1>
      <p>Hey ${name},</p>
      <p>Your MatFlow free trial is ending soon. Subscribe now to keep managing your gym with MatFlow.</p>
      <p><a href="https://app.mymatflow.com/admin/billing" style="display:inline-block;background:#c4b5a0;color:#111;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Choose a Plan</a></p>
      <p style="color:#888;font-size:12px;margin-top:32px;">Powered by MatFlow</p>
    </div>
  `;
  send(email, `Your MatFlow trial ends in ${daysLeft} days`, html).catch(() => {});
}

export function sendClassReminder(
  email: string,
  name: string,
  classType: string,
  time: string,
  gymName: string
) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#c4b5a0;">Class Today!</h1>
      <p>Hey ${name},</p>
      <p>You have <strong>${classType}</strong> today at <strong>${time}</strong>.</p>
      <p>See you on the mats!</p>
      <p style="color:#888;font-size:12px;margin-top:32px;">${gymName} . Powered by MatFlow</p>
    </div>
  `;
  send(email, `Reminder: ${classType} today at ${time}`, html).catch(() => {});
}

export function sendJoinRequestSubmittedToAdmin(email: string, studentName: string, gymName: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#c4b5a0;">New Join Request</h1>
      <p><strong>${studentName}</strong> has requested to join <strong>${gymName}</strong> on MatFlow.</p>
      <p><a href="https://app.mymatflow.com/app/requests" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Review Request</a></p>
      <p style="color:#888;font-size:12px;margin-top:32px;">${gymName}. Powered by MatFlow</p>
    </div>
  `;
  send(email, `New join request from ${studentName}`, html).catch(() => {});
}

export function sendJoinRequestApprovedToStudent(email: string, studentName: string, gymName: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#c4b5a0;">You are in!</h1>
      <p>Hey ${studentName},</p>
      <p>Your request to join <strong>${gymName}</strong> has been approved. You can now access the full member portal: schedule, attendance, belt progression, videos, and more.</p>
      <p><a href="https://app.mymatflow.com/student" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Open MatFlow</a></p>
      <p>See you on the mats!</p>
      <p style="color:#888;font-size:12px;margin-top:32px;">Powered by MatFlow</p>
    </div>
  `;
  send(email, `You are approved at ${gymName}!`, html).catch(() => {});
}

export function notifyAdminOfNewStudent(student: { firstName: string; lastName: string; email: string; phone?: string | null }) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#111;">
      <h2 style="margin-bottom:16px;">New MatFlow Student</h2>
      <table cellpadding="6" style="font-size:14px;">
        <tr><td><strong>Name</strong></td><td>${student.firstName} ${student.lastName}</td></tr>
        <tr><td><strong>Email</strong></td><td>${student.email}</td></tr>
        <tr><td><strong>Phone</strong></td><td>${student.phone || "—"}</td></tr>
        <tr><td><strong>When</strong></td><td>${new Date().toLocaleString()}</td></tr>
      </table>
    </div>
  `;
  send("franklujan@gmail.com", `New MatFlow Student: ${student.firstName} ${student.lastName}`, html).catch(() => {});
}

export function sendJoinRequestRejectedToStudent(email: string, studentName: string, gymName: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#c4b5a0;">Update on your request</h1>
      <p>Hey ${studentName},</p>
      <p>Your request to join <strong>${gymName}</strong> was not approved at this time. You can still reach out to the gym directly to learn more.</p>
      <p>You can browse other gyms on MatFlow and request to join them.</p>
      <p><a href="https://app.mymatflow.com/student/gyms" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Find Other Gyms</a></p>
      <p style="color:#888;font-size:12px;margin-top:32px;">Powered by MatFlow</p>
    </div>
  `;
  send(email, `Update from ${gymName}`, html).catch(() => {});
}
