const pool = require('./db');

// Each tool is a safe, pre-written query. The AI can only ever call these
// exact functions with these exact parameters - it can never write or run
// arbitrary SQL against the real database.

async function getRecentSuspensions({ days = 7, limit = 20 }) {
  const result = await pool.query(
    `SELECT license_no, business_name, business_phone, suspension_reason, suspension_date
     FROM suspended_contractors
     WHERE has_reliable_date = true
       AND suspension_date >= NOW() - INTERVAL '1 day' * $1
     ORDER BY suspension_date DESC
     LIMIT $2`,
    [days, limit]
  );
  return result.rows;
}

async function searchByName({ query }) {
  const result = await pool.query(
    `SELECT license_no, business_name, business_phone, primary_status,
            suspension_reason, suspension_date
     FROM suspended_contractors
     WHERE business_name ILIKE $1 OR license_no = $2
     LIMIT 10`,
    [`%${query}%`, query]
  );
  return result.rows;
}

async function getByReason({ reason, limit = 20 }) {
  // Map friendly reason terms to the actual primary_status values in the data
  const reasonMap = {
    bond: 'Contr Bond Susp',
    'workers comp': 'Work Comp Susp',
    'workers compensation': 'Work Comp Susp',
    liability: 'Liab Ins Susp',
  };
  const statusValue = reasonMap[reason.toLowerCase()] || reason;

  const result = await pool.query(
    `SELECT license_no, business_name, business_phone, suspension_reason, suspension_date
     FROM suspended_contractors
     WHERE primary_status = $1
     ORDER BY suspension_date DESC NULLS LAST
     LIMIT $2`,
    [statusValue, limit]
  );
  return result.rows;
}

async function getSummaryCounts() {
  const result = await pool.query(
    `SELECT primary_status, COUNT(*) as count
     FROM suspended_contractors
     GROUP BY primary_status
     ORDER BY count DESC`
  );
  const total = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
  return { total, breakdown: result.rows };
}

module.exports = {
  getRecentSuspensions,
  searchByName,
  getByReason,
  getSummaryCounts,
};