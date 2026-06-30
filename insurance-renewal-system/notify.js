require('dotenv').config();
const { Resend } = require('resend');
const pool = require('./db');

const resend = new Resend(process.env.RESEND_API_KEY);

// Builds a simple HTML email listing the newly suspended contractors
function buildEmailHtml(rows) {
  const rowsHtml = rows
    .map(
      (r) => `
      <tr style="border-bottom: 1px solid #E3E1DC;">
        <td style="padding: 8px 12px; font-weight: 600;">${r.business_name || 'Unnamed business'}</td>
        <td style="padding: 8px 12px;">${r.license_no}</td>
        <td style="padding: 8px 12px;">${r.suspension_reason}</td>
        <td style="padding: 8px 12px;">${r.business_phone || 'No phone on file'}</td>
      </tr>`
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color: #1A2B4C;">Aster National — New Suspensions Today</h2>
      <p style="color: #6B7280;">
        ${rows.length} contractor${rows.length === 1 ? '' : 's'} newly flagged for
        suspended bond or insurance coverage. Sorted most recent first.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #1A2B4C; color: white; text-align: left;">
            <th style="padding: 8px 12px;">Business</th>
            <th style="padding: 8px 12px;">License #</th>
            <th style="padding: 8px 12px;">Reason</th>
            <th style="padding: 8px 12px;">Phone</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

async function runNotificationCheck() {
  console.log(`[${new Date().toISOString()}] Checking for newly suspended contractors...`);

  // Find suspended contractors we haven't notified about yet
  const result = await pool.query(`
    SELECT license_no, business_name, business_phone, suspension_reason, suspension_date
    FROM suspended_contractors
    WHERE has_reliable_date = true
    AND license_no IN (
      SELECT license_no FROM contractors WHERE last_notified_at IS NULL
    )
    ORDER BY suspension_date DESC
    LIMIT 50
  `);

  const newRecords = result.rows;

  if (newRecords.length === 0) {
    console.log('No new suspensions to report today.');
    return { sent: false, count: 0 };
  }

  // Send the email
  await resend.emails.send({
    from: 'onboarding@resend.dev', // Resend's default sender for testing
    to: process.env.BOSS_EMAIL,
    subject: `${newRecords.length} new contractor suspension${newRecords.length === 1 ? '' : 's'} — Aster National`,
    html: buildEmailHtml(newRecords),
  });

  // Mark these as notified so we don't email about them again tomorrow
  const licenseNumbers = newRecords.map((r) => r.license_no);
  await pool.query(
    `UPDATE contractors SET last_notified_at = NOW() WHERE license_no = ANY($1)`,
    [licenseNumbers]
  );

  console.log(`Sent notification email for ${newRecords.length} contractors.`);
  return { sent: true, count: newRecords.length };
}

module.exports = { runNotificationCheck };