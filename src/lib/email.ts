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
      <h1 style="color:#0fe69b;margin-bottom:8px;">Welcome to ${gymName}!</h1>
      <p>Hey ${name},</p>
      <p>Your account on MatFlow is ready. You can now:</p>
      <ul>
        <li>View the class schedule and commit to sessions</li>
        <li>Track your belt progression and techniques</li>
        <li>Shop the pro shop</li>
        <li>View your attendance history</li>
      </ul>
      <p>See you on the mats!</p>
      <p style="color:#888;font-size:12px;margin-top:32px;">Powered by MatFlow &mdash; mymatflow.com</p>
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
      <h1 style="color:#0fe69b;">Order Confirmed!</h1>
      <p>Hey ${name},</p>
      <p>Your order <strong>#${orderId.slice(-8).toUpperCase()}</strong> has been placed.</p>
      <p style="font-size:24px;font-weight:bold;color:#0fe69b;">Total: $${total.toFixed(2)}</p>
      <p>Payment will be collected at pickup or by arrangement. Contact your gym for details.</p>
      <p style="color:#888;font-size:12px;margin-top:32px;">${gymName} &mdash; Powered by MatFlow</p>
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
      <h1 style="color:#0fe69b;">Congratulations, ${name}!</h1>
      <p style="font-size:20px;">You have been promoted to</p>
      <p style="font-size:32px;font-weight:bold;text-transform:uppercase;">${newBelt} Belt${stripes > 0 ? ` (${stripes} stripe${stripes > 1 ? "s" : ""})` : ""}</p>
      <p>Your hard work and dedication on the mats has paid off. Keep training!</p>
      <p style="color:#888;font-size:12px;margin-top:32px;">${gymName} &mdash; Powered by MatFlow</p>
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
      <p><a href="https://app.mymatflow.com/admin/billing" style="display:inline-block;background:#0fe69b;color:#111;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Choose a Plan</a></p>
      <p style="color:#888;font-size:12px;margin-top:32px;">Powered by MatFlow &mdash; mymatflow.com</p>
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
      <h1 style="color:#0fe69b;">Class Today!</h1>
      <p>Hey ${name},</p>
      <p>You have <strong>${classType}</strong> today at <strong>${time}</strong>.</p>
      <p>See you on the mats!</p>
      <p style="color:#888;font-size:12px;margin-top:32px;">${gymName} &mdash; Powered by MatFlow</p>
    </div>
  `;
  send(email, `Reminder: ${classType} today at ${time}`, html).catch(() => {});
}
