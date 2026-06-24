import { WorkerMailer } from "worker-mailer";

export interface SmtpSendInput {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly username: string;
  readonly password: string;
  readonly fromName: string;
  readonly fromEmail: string;
  readonly replyTo?: string | null;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
}

export async function sendViaSmtp(input: SmtpSendInput): Promise<void> {
  const mailer = await WorkerMailer.connect({
    host: input.host,
    port: input.port,
    secure: input.secure,
    credentials: { username: input.username, password: input.password },
    authType: ["plain", "login"],
  });

  try {
    await mailer.send({
      from: { name: input.fromName, email: input.fromEmail },
      to: input.to,
      replyTo: input.replyTo ?? undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } finally {
    try { await mailer.close(); } catch { /* ignore */ }
  }
}
