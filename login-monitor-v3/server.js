const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
require('./database');
const { pageLogin, pageAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,   // avoids upgrade-insecure-requests on http://localhost
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],  // Chart.js CDN
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '10kb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 1000 }  // 1 hour
}));
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/admin', require('./routes/admin'));

// Pages
const view = f => (req, res) => res.sendFile(path.join(__dirname, 'views', f));
app.get('/', view('landing.html'));
app.get('/login', view('login.html'));
app.get('/register', view('register.html'));
app.get('/dashboard', pageLogin, view('dashboard.html'));
app.get('/history', pageLogin, view('history.html'));
app.get('/profile', pageLogin, view('profile.html'));
app.get('/change-password', pageLogin, view('change-password.html'));
app.get('/admin', pageAdmin, view('admin-dashboard.html'));
app.get('/admin/logs', pageAdmin, view('admin-logs.html'));
app.get('/admin/locked', pageAdmin, view('admin-locked.html'));
app.get('/admin/ips', pageAdmin, view('admin-ips.html'));
app.get('/admin/users', pageAdmin, view('admin-users.html'));

app.use((req, res) => res.status(404).send('Page not found'));
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
