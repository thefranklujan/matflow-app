/**
 * MatFlow launch campaign email for BJJ gym owners.
 * Uses the brand email shell from email.ts styling.
 */
export const LAUNCH_CAMPAIGN_SUBJECT = "Built for BJJ. Free for early gyms.";

export const LAUNCH_CAMPAIGN_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>MatFlow</title></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

  <!-- Header -->
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
        <div style="font-size:10px;font-weight:700;color:#dc2626;letter-spacing:1.5px;text-transform:uppercase;margin-top:6px;">EARLY ACCESS</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:36px 32px 8px 32px;">
    <h1 style="margin:0 0 20px 0;font-size:28px;line-height:1.2;color:#ffffff;font-weight:800;letter-spacing:-0.5px;">Your gym deserves better software.</h1>
    <div style="font-size:15px;line-height:1.7;color:#a3a3a3;">
      <p style="margin:0 0 16px 0;">We built MatFlow because gym management tools were not made for jiu jitsu. They are built for globo gyms. You run a martial arts academy. You need something different.</p>

      <p style="margin:0 0 16px 0;color:#ffffff;font-weight:600;">MatFlow handles everything you actually need:</p>

      <table cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;width:100%;">
        <tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#dc2626;font-weight:700;margin-right:8px;">01</span> Class schedule and attendance tracking
        </td></tr>
        <tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#dc2626;font-weight:700;margin-right:8px;">02</span> Belt and stripe progression for every student
        </td></tr>
        <tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#dc2626;font-weight:700;margin-right:8px;">03</span> Kiosk check-in with custom codes
        </td></tr>
        <tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#dc2626;font-weight:700;margin-right:8px;">04</span> Built-in pro shop with orders and inventory
        </td></tr>
        <tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#dc2626;font-weight:700;margin-right:8px;">05</span> Video library, waivers, announcements
        </td></tr>
        <tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">
          <span style="color:#dc2626;font-weight:700;margin-right:8px;">06</span> Competition tracking and analytics
        </td></tr>
      </table>

      <p style="margin:0 0 16px 0;">No contracts. No setup fees. Everything your gym needs in one place.</p>

      <div style="background:#000000;border:1px solid rgba(220,38,38,0.3);border-radius:10px;padding:18px 20px;margin:0 0 20px 0;">
        <div style="font-size:12px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:6px;">Limited Launch Offer</div>
        <div style="font-size:16px;color:#ffffff;font-weight:600;">The first 50 gyms that sign up get <span style="color:#dc2626;">free access</span> while we build this with you. Help shape the platform. Pay nothing.</div>
      </div>

      <p style="margin:0;">We are opening spots now. If you want in, claim yours before they are gone.</p>
    </div>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:28px 32px 8px 32px;" align="left">
    <a href="https://mymatflow.com" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;">Claim Your Free Spot</a>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:32px 32px 24px 32px;border-top:1px solid rgba(255,255,255,0.06);margin-top:24px;">
    <div style="font-size:11px;color:#525252;line-height:1.6;text-align:center;">
      MatFlow &middot; The training companion built for jiu jitsu<br>
      <a href="https://mymatflow.com" style="color:#525252;text-decoration:underline;">mymatflow.com</a>
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
