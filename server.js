const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!ADMIN_PASSWORD || !SESSION_SECRET) {
  console.error('Missing ADMIN_PASSWORD or SESSION_SECRET. Set both environment variables before starting.');
  process.exit(1);
}

const root = __dirname;
const dataDir = path.join(root, 'data');
const uploadDir = path.join(root, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(path.join(dataDir, 'rlap.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_no TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  post TEXT NOT NULL,
  name TEXT NOT NULL,
  dob TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT,
  year TEXT NOT NULL,
  roll TEXT NOT NULL,
  dept TEXT NOT NULL,
  institute TEXT NOT NULL,
  address TEXT,
  photo_filename TEXT NOT NULL,
  experience TEXT NOT NULL,
  intro TEXT,
  reason TEXT
)`);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '100kb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 2 * 60 * 60 * 1000 }
}));

const submitLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

const allowedPosts = new Set(['President','Vice President','General Secretary','Joint Secretary']);
const allowedInstitutes = new Set(['College of Agriculture Sumerpur','Other']);
const allowedYears = new Set(['1st Year','2nd Year','3rd Year','4th Year','Other']);
const allowedExperience = new Set(['Yes','No']);
const allowedMime = new Set(['image/jpeg','image/png','image/webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, allowedMime.has(file.mimetype))
});

function clean(v, max=2000) { return String(v ?? '').trim().slice(0, max); }
function validMobile(v) { return /^\d{10}$/.test(v); }
function requireAdmin(req,res,next) { if (req.session.isAdmin) return next(); return res.redirect('/admin/login'); }
function newApplicationNo() { return `RLAP-${Date.now().toString().slice(-8)}-${Math.floor(Math.random()*90+10)}`; }

app.get('/', (_req,res) => res.sendFile(path.join(root,'public','index.html')));
app.get('/uploads/:file', requireAdmin, (req,res) => {
  const file = path.basename(req.params.file);
  res.sendFile(path.join(uploadDir,file));
});

app.post('/api/applications', submitLimiter, upload.single('photo'), (req,res) => {
  const d = req.body;
  const values = {
    post: clean(d.post,50), name: clean(d.name,120), dob: clean(d.dob,20), mobile: clean(d.mobile,10),
    email: clean(d.email,160), year: clean(d.year,30), roll: clean(d.roll,60), dept: clean(d.dept,80),
    institute: clean(d.institute,100), address: clean(d.address,500), experience: clean(d.experience,10),
    intro: clean(d.intro,2000), reason: clean(d.reason,2000)
  };
  if (!req.file) return res.status(400).json({error:'Candidate photo is required.'});
  if (!allowedPosts.has(values.post) || !values.name || !values.dob || !validMobile(values.mobile) || !allowedYears.has(values.year) || !values.roll || !values.dept || !allowedInstitutes.has(values.institute) || !allowedExperience.has(values.experience)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({error:'Please complete all required fields correctly.'});
  }
  const applicationNo = newApplicationNo();
  db.prepare(`INSERT INTO applications (application_no,created_at,post,name,dob,mobile,email,year,roll,dept,institute,address,photo_filename,experience,intro,reason)
    VALUES (@applicationNo,@createdAt,@post,@name,@dob,@mobile,@email,@year,@roll,@dept,@institute,@address,@photoFilename,@experience,@intro,@reason)`).run({
      applicationNo, createdAt: new Date().toISOString(), ...values, photoFilename: req.file.filename
    });
  res.json({ ok:true, applicationNo });
});

app.get('/admin/login', (_req,res) => res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>RLAP Admin Login</title><style>body{font-family:Arial,sans-serif;background:#edf2ed;display:grid;place-items:center;min-height:100vh;margin:0}.card{background:#fff;padding:28px;border-radius:16px;box-shadow:0 8px 30px #0001;width:min(420px,90vw)}h1{color:#075b2d}input,button{width:100%;padding:12px;margin-top:10px;box-sizing:border-box}button{background:#075b2d;color:white;border:0;border-radius:8px;font-weight:700}</style></head><body><div class="card"><h1>RLAP Admin</h1><p>Authorized administrator only.</p><form method="post" action="/admin/login"><input name="password" type="password" placeholder="Admin password" required autofocus><button>Login</button></form></div></body></html>`));
app.post('/admin/login', loginLimiter, (req,res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).send('Invalid password. <a href="/admin/login">Try again</a>');
  req.session.regenerate(err => { if (err) return res.status(500).send('Login error'); req.session.isAdmin=true; res.redirect('/admin'); });
});
app.post('/admin/logout', requireAdmin, (req,res) => req.session.destroy(() => res.redirect('/admin/login')));
app.get('/admin', requireAdmin, (_req,res) => {
  const rows = db.prepare('SELECT * FROM applications ORDER BY id DESC').all();
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const body = rows.map(r=>`<tr><td>${esc(r.application_no)}</td><td>${esc(r.created_at)}</td><td>${esc(r.post)}</td><td>${esc(r.name)}</td><td>${esc(r.mobile)}</td><td>${esc(r.email)}</td><td>${esc(r.institute)}</td><td>${esc(r.year)}</td><td>${esc(r.roll)}</td><td>${esc(r.dept)}</td><td>${esc(r.experience)}</td><td><a target="_blank" href="/uploads/${encodeURIComponent(r.photo_filename)}">Photo</a></td></tr>`).join('');
  res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>RLAP Admin Applications</title><style>body{font-family:Arial,sans-serif;background:#edf2ed;margin:0;color:#17321f}header{background:#075b2d;color:#fff;padding:18px;display:flex;justify-content:space-between;align-items:center}button{padding:9px 14px;border:0;border-radius:7px;font-weight:700}main{padding:18px;overflow:auto}table{background:#fff;border-collapse:collapse;min-width:1300px}th,td{border:1px solid #d9e4db;padding:9px;text-align:left;font-size:13px}th{background:#f3d51b}h2{color:#075b2d}</style></head><body><header><b>RLAP — Admin Applications</b><form method="post" action="/admin/logout"><button>Logout</button></form></header><main><h2>Submitted Applications (${rows.length})</h2><table><thead><tr><th>Application No.</th><th>Submitted</th><th>Post</th><th>Name</th><th>Mobile</th><th>Email</th><th>Institute</th><th>Year</th><th>Roll</th><th>Department</th><th>Experience</th><th>Photo</th></tr></thead><tbody>${body || '<tr><td colspan="12">No applications yet.</td></tr>'}</tbody></table></main></body></html>`);
});

app.use(express.static(path.join(root,'public'), { index:false }));
app.listen(PORT, () => console.log(`RLAP portal running on port ${PORT}`));
