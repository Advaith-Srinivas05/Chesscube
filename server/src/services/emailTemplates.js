export const CODE_EXPIRY_MINUTES = 15;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Table layout and inline styles only: email clients ignore most CSS and images are often blocked.
function layout({ heading, intro, code, footer }) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3ecd8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3ecd8;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffced;border:1px solid #e6dbc1;border-radius:14px;font-family:Arial,Helvetica,sans-serif;color:#3c2206;">
            <tr>
              <td style="padding:28px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:bold;letter-spacing:4px;">CHESSCUBE</td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;">${heading}</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px;">
                <div style="display:inline-block;padding:14px 22px;background:#f3ecd8;border-radius:10px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:10px;">${code}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;font-size:13px;line-height:1.5;color:#7a654d;">
                <p style="margin:0 0 8px;">This code expires in ${CODE_EXPIRY_MINUTES} minutes.</p>
                <p style="margin:0;">${footer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verificationEmail({ username, code }) {
  const name = escapeHtml(username);
  return {
    subject: `${code} is your Chesscube verification code`,
    text: [
      `Hi ${username},`,
      '',
      `Your Chesscube verification code is ${code}.`,
      `It expires in ${CODE_EXPIRY_MINUTES} minutes.`,
      '',
      "If you didn't sign up for Chesscube, you can ignore this email.",
    ].join('\n'),
    html: layout({
      heading: 'Verify your email',
      intro: `Hi ${name}, enter this code to finish creating your Chesscube account.`,
      code,
      footer: "If you didn't sign up for Chesscube, you can ignore this email.",
    }),
  };
}

export function passwordResetEmail({ code }) {
  return {
    subject: `${code} is your Chesscube password reset code`,
    text: [
      `Your Chesscube password reset code is ${code}.`,
      `It expires in ${CODE_EXPIRY_MINUTES} minutes.`,
      '',
      "If you didn't ask to reset your password, you can ignore this email. Your password won't change.",
    ].join('\n'),
    html: layout({
      heading: 'Reset your password',
      intro: 'Enter this code to choose a new password for your Chesscube account.',
      code,
      footer: "If you didn't ask to reset your password, you can ignore this email. Your password won't change.",
    }),
  };
}
