// Google Apps Script web app that sends Chesscube's emails from the Gmail account that owns the script.
// Setup (README → Email): paste this into a new project at script.google.com, add the script property SECRET
// (Project Settings → Script properties), then Deploy → New deployment → Web app, execute as Me, access Anyone.
// The server calls it with MAIL_SCRIPT_URL and MAIL_SCRIPT_SECRET.

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'BAD_JSON' });
  }

  var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret || body.secret !== secret) return reply({ ok: false, error: 'UNAUTHORIZED' });

  // The server checks the connection at startup without sending anything.
  if (body.ping) return reply({ ok: true, remaining: MailApp.getRemainingDailyQuota() });

  if (typeof body.to !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(body.to) || typeof body.subject !== 'string') {
    return reply({ ok: false, error: 'BAD_MESSAGE' });
  }
  if (MailApp.getRemainingDailyQuota() < 1) return reply({ ok: false, error: 'QUOTA_EXCEEDED' });

  try {
    MailApp.sendEmail({
      to: body.to,
      subject: body.subject,
      body: body.text || '',
      htmlBody: body.html || undefined,
      name: body.name || 'Chesscube',
    });
  } catch (err) {
    return reply({ ok: false, error: 'SEND_FAILED' });
  }
  return reply({ ok: true });
}

function reply(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
