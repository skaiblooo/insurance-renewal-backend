const { runNotificationCheck } = require('./notify');
const pool = require('./db');

runNotificationCheck()
  .then(async (result) => {
    console.log('Done:', result);
    await pool.end(); // close database connections cleanly before exiting
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Notification check failed:', err);
    await pool.end();
    process.exit(1);
  });