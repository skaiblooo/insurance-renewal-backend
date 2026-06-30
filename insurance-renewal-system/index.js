const express = require('express');
const cors = require('cors');
const pool = require('./db');
const cron = require('node-cron');
const { runNotificationCheck } = require('./notify');
const app = express();
const PORT = 3001;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// JWT verification middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/suspended-contractors', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM prioritized_suspensions
       ORDER BY priority_score DESC, suspension_date DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching suspended contractors:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});
const { chat } = require('./chat');

app.post('/api/chat', verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const reply = await chat(message);
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Run the notification check automatically every day at 8:00 AM
cron.schedule('0 8 * * *', async () => {
  console.log('Running scheduled notification check...');
  try {
    await runNotificationCheck();
  } catch (err) {
    console.error('Scheduled notification check failed:', err);
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token - valid for 24 hours
    jwt.sign(
  { userId: user.id, username: user.username },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});