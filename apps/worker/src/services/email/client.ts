import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY || "");

export const FROM_EMAIL = "SocialPilot <notifications@socialpilot.app>";

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] RESEND_API_KEY not set — skipping email to", to);
    return false;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    console.log("[Email] Sent:", subject, "→", to);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return false;
  }
}
