import { sendEmail } from "../mailer.ts";

// without token for now
export async function sendConfirmationEmail(to: string) {
  const email = await sendEmail(
    to,
    "Confirm your email",
    `Click here to confirm your email: <a>fake-link</a>`
  );
  if (!email) {
    throw new Error("Failed to send email");
  }
  return email;
}
