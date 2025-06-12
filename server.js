const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const fetch = require('node-fetch');
const cookieParser = require('cookie-parser');
const app = express();

// Settings
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'SecretPassword321';
const LOG_FILE = path.join(__dirname, 'logs', 'activity.log');
const loginAttempts = {};

// Middleware
app.use(express.json());
app.use(cookieParser());
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

// Admin login
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
        res.cookie("admin", true, { httpOnly: true });
        return res.json({ success: true, message: "Logged in as admin" });
    } else {
        loginAttempts[ip].count++;
        return res.status(401).json({ success: false, message: "Wrong password" });
    }
});

// Admin log viewer
app.get('/logs', (req, res) => {
    if (req.cookies.admin !== 'true') {
        return res.status(403).send("Forbidden");
    }
    if (fs.existsSync(LOG_FILE)) {
        const logs = fs.readFileSync(LOG_FILE, 'utf8');
        res.send(logs);
    } else {
        res.send("No logs yet.");
    }
});

// Proxy route
app.get('/proxy/:url', async (req, res) => {
    try {
        const target = decodeURIComponent(req.params.url);
        const response = await fetch(`https://${target}`);
        const html = await response.text();
        res.send(html);
    } catch (err) {
        res.status(500).send("Proxy error: " + err.message);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`ClassWave Proxy running on port ${PORT}`);
});
