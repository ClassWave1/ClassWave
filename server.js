
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const app = express();

// Settings
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'vibloadmin123';
const LOG_FILE = path.join(__dirname, 'logs', 'activity.log');
const loginAttempts = {};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Brute-force protection
const limiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 100
});
app.use(limiter);

// Log every visit
app.use((req, res, next) => {
    const logEntry = `[${new Date().toISOString()}] ${req.ip} visited ${req.originalUrl}\n`;
    fs.appendFileSync(LOG_FILE, logEntry);
    next();
});

// Admin panel (unguessable path)
app.post('/adminlogin', (req, res) => {
    const ip = req.ip;
    if (!loginAttempts[ip]) loginAttempts[ip] = { count: 0, time: Date.now() };

    if (Date.now() - loginAttempts[ip].time > 300000) {
        loginAttempts[ip] = { count: 0, time: Date.now() };
    }

    if (loginAttempts[ip].count >= 5) {
        return res.status(429).send("Too many failed attempts. Try later.");
    }

    const { password } = req.body;
    if (password === ADMIN_SECRET) {
        return res.json({ success: true, message: "Logged in as admin" });
    } else {
        loginAttempts[ip].count++;
        return res.status(401).json({ success: false, message: "Wrong password" });
    }
});

// Dummy proxy route
app.get('/proxy/:url', (req, res) => {
    res.send(`Pretend we're proxying: ${req.params.url}`);
});

// Start server
app.listen(PORT, () => {
    console.log(`VibloProxy running on port ${PORT}`);
});
