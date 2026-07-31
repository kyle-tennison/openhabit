import { Resend } from "resend";

const client = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.MAIL_FROM || "onboarding@resend.dev";
const replyTo = process.env.MAIL_REPLY_TO || "support@openhabit.co";

export const mailConfigured = () => client !== null;

export async function sendPasswordReset(to, resetUrl) {
  if (!client) throw new Error("RESEND_API_KEY is not set");

  const { error } = await client.emails.send({
    from,
    to,
    replyTo,
    subject: "Reset your openhabit password",
    text:
      `Someone asked to reset the password for your openhabit account.\n\n` +
      `${resetUrl}\n\n` +
      `The link works once and expires in an hour. ` +
      `If this wasn't you, ignore this email — nothing has changed.`,
    html: `
      <div style="font-family:Roboto,Helvetica,Arial,sans-serif;color:#26332a;line-height:1.5">
        <p>Someone asked to reset the password for your openhabit account.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#4f7d55;color:#fff;text-decoration:none;
                    padding:10px 18px;border-radius:10px">Reset password</a>
        </p>
        <p style="color:#6e7d70;font-size:14px">
          The link works once and expires in an hour.
          If this wasn't you, ignore this email — nothing has changed.
        </p>
        <p style="color:#6e7d70;font-size:12px;word-break:break-all">${resetUrl}</p>
      </div>
    `,
  });

  // The SDK reports failures in the payload rather than throwing.
  if (error) throw new Error(error.message || "Failed to send email");
}
