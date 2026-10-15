const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const crypto   = require('crypto');
const mongoose = require('mongoose');
const path     = require('path');
const fs       = require('fs');

const User     = require('./models/User');
const File     = require('./models/File');
const AuditLog = require('./models/AuditLog');

const app  = express();
const PORT = 5000;

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose.connect('mongodb://localhost:27017/simple-file', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.on('connected', () => console.log('MongoDB connected'));
mongoose.connection.on('error',     (e) => console.error('MongoDB error:', e));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use(cors());

// ── Auto-create uploads folder ─────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Multer ──────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });
// ── Brute-force tracker (in-memory: key -> { count, lockedUntil }) ────────────
const bruteForce = {};

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

// ── Audit log helper ──────────────────────────────────────────────────────────
async function log(action, { userId = null, fileId = null, filename = '', ip = 'unknown', details = '', success = true } = {}) {
  try {
    await AuditLog.create({ userId, fileId, filename, action, ip, details, success });
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

// ── Crypto helpers ────────────────────────────────────────────────────────────
function encryptFile(inputPath, outputPath, key) {
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
  const input  = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);
  return new Promise((resolve, reject) => {
    input.pipe(cipher).pipe(output)
      .on('finish', () => resolve(iv.toString('hex')))
      .on('error',  reject);
  });
}

function decryptFile(inputPath, outputPath, key, iv) {
  const decipher = crypto.createDecipheriv('aes-256-ctr', key, Buffer.from(iv, 'hex'));
  const input    = fs.createReadStream(inputPath);
  const output   = fs.createWriteStream(outputPath);
  return new Promise((resolve, reject) => {
    input.pipe(decipher).pipe(output)
      .on('finish', resolve)
      .on('error',  reject);
  });
}

// ── Auto-delete expired files (every 60s) ────────────────────────────────────
setInterval(async () => {
  try {
    const expired = await File.find({ expiresAt: { $lte: new Date(), $ne: null } });
    for (const file of expired) {
      const fp = path.join(UPLOADS_DIR, file.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      await File.findByIdAndDelete(file._id);
    }
  } catch (err) { console.error('Auto-delete error:', err); }
}, 60 * 1000);

// ═════════════════════════════════════════════════════════════════════════════
//  AUTH
// ═════════════════════════════════════════════════════════════════════════════

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Username already taken.' });
    await new User({ username, password }).save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) { res.status(500).json({ error: 'Error registering user' }); }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.status(200).json({ message: 'Login successful', userId: user._id, username: user.username });
  } catch (err) { res.status(500).json({ error: 'Error logging in' }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  USER PROFILE
// ═════════════════════════════════════════════════════════════════════════════

app.get('/profile/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const fileCount = await File.countDocuments({ userId: req.params.userId });
    res.status(200).json({ username: user.username, fileCount, joinedAt: user._id.getTimestamp() });
  } catch (err) { res.status(500).json({ error: 'Error fetching profile.' }); }
});

app.put('/profile/:userId/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.password !== currentPassword) return res.status(403).json({ error: 'Current password is incorrect.' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    user.password = newPassword;
    await user.save();
    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err) { res.status(500).json({ error: 'Error changing password.' }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  UPLOAD & ENCRYPT
// ═════════════════════════════════════════════════════════════════════════════

app.post('/upload', upload.single('file'), async (req, res) => {
  try {

    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded.'
      });
    }

    const userId = req.body.userId;
    const expiresIn = req.body.expiresIn || 'never';

    console.log("userId:", userId);
    console.log("expiresIn:", expiresIn);

    const secretKey = crypto.randomBytes(32).toString('hex');

    const encryptedFilePath = path.join(
      UPLOADS_DIR,
      `enc-${req.file.filename}`
    );

    console.log("Original Path:", req.file.path);
    console.log("Encrypted Path:", encryptedFilePath);

    // CHECK FILE EXISTS
    if (!fs.existsSync(req.file.path)) {

      console.log("Uploaded file missing!");

      return res.status(500).json({
        error: "Uploaded file missing from uploads folder."
      });
    }

    let iv;

    try {

      iv = await encryptFile(
        req.file.path,
        encryptedFilePath,
        Buffer.from(secretKey, 'hex')
      );

      console.log("Encryption Success");

    } catch (encError) {

      console.log("ENCRYPT ERROR:", encError);

      return res.status(500).json({
        error: encError.message
      });
    }

    fs.unlinkSync(req.file.path);

    console.log("Original File Deleted");

    const file = new File({
      userId,
      filename: `enc-${req.file.filename}`,
      originalName: req.file.originalname,
      iv,
      secretKey
    });

    await file.save();

    console.log("Mongo Save Success");

    res.status(200).json({
      message: 'File uploaded successfully',
      secretKey,
      iv,
      filename: file.filename
    });

  } catch (error) {

    console.log("UPLOAD ERROR:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  DOWNLOAD & DECRYPT  (brute-force lockout built in)
// ═════════════════════════════════════════════════════════════════════════════

app.post('/download/:filename', async (req, res) => {
  const { filename }      = req.params;
  const { secretKey, iv } = req.body;
  const ip                = getClientIp(req);

  try {
    if (!filename || !secretKey || !iv) return res.status(400).json({ error: 'Missing required fields.' });

    const file = await File.findOne({ filename });
    if (!file) return res.status(404).json({ error: 'File not found.' });
    if (file.expiresAt && new Date() > file.expiresAt) return res.status(410).json({ error: 'This file has expired.' });

    // ── Brute-force guard ─────────────────────────────────────────────────────
    const bfKey = file._id.toString();
    if (!bruteForce[bfKey]) bruteForce[bfKey] = { count: 0, lockedUntil: null };
    const bf = bruteForce[bfKey];

    if (bf.lockedUntil && new Date() < bf.lockedUntil) {
      const secsLeft = Math.ceil((bf.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({ error: `File locked. Try again in ${secsLeft} seconds.`, lockedSeconds: secsLeft });
    }

    if (file.secretKey !== secretKey) {
      bf.count += 1;
      const attemptsLeft = 5 - bf.count;
      await log('WRONG_KEY', { userId: file.userId, fileId: file._id, filename: file.originalName, ip, details: `Attempt ${bf.count}/5`, success: false });

      if (bf.count >= 5) {
        bf.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        bf.count = 0;
        await log('BRUTE_FORCE_LOCKED', { userId: file.userId, fileId: file._id, filename: file.originalName, ip, details: 'Locked 15 minutes', success: false });
        return res.status(429).json({ error: 'Too many wrong attempts. File locked for 15 minutes.', lockedSeconds: 900 });
      }
      return res.status(403).json({ error: `Invalid secret key. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining before lockout.`, attemptsLeft });
    }

    // Correct — reset counter
    bruteForce[bfKey] = { count: 0, lockedUntil: null };

    const encPath = path.join(UPLOADS_DIR, filename);
    const decPath = path.join(UPLOADS_DIR, `dec-${Date.now()}-${filename}`);
    await decryptFile(encPath, decPath, Buffer.from(secretKey, 'hex'), iv);

    await log('DOWNLOAD', { userId: file.userId, fileId: file._id, filename: file.originalName, ip, details: 'Success' });

    res.download(decPath, file.originalName, () => { if (fs.existsSync(decPath)) fs.unlinkSync(decPath); });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  FILES LIST / VERIFY / DELETE
// ═════════════════════════════════════════════════════════════════════════════

app.get('/files', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'User ID is required.' });
  try {
    const files = await File.find({ userId });
    res.status(200).json(files);
  } catch (err) { res.status(500).json({ error: 'Error fetching files.' }); }
});

app.post('/verify-key', async (req, res) => {
  const { secretKey } = req.body;
  try {
    const file = await File.findOne({ secretKey });
    if (!file) return res.status(404).json({ error: 'Invalid secret key or file not found.' });
    if (file.expiresAt && new Date() > file.expiresAt) return res.status(410).json({ error: 'This file has expired.' });
    res.status(200).json({ fileId: file._id, filename: file.filename, originalName: file.originalName, iv: file.iv });
  } catch (error) { res.status(500).json({ error: 'Internal server error.' }); }
});

app.delete('/files/:id', async (req, res) => {
  const { id } = req.params; const { userId } = req.query; const ip = getClientIp(req);
  try {
    const file = await File.findOneAndDelete({ _id: id, userId });
    if (!file) return res.status(404).json({ error: 'File not found or unauthorized.' });
    const fp = path.join(UPLOADS_DIR, file.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await log('DELETE', { userId, fileId: id, filename: file.originalName, ip });
    res.status(200).json({ message: 'File deleted successfully.' });
  } catch (error) { res.status(500).json({ error: 'Error deleting file.' }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  SHARE LINKS  (+ one-time download)
// ═════════════════════════════════════════════════════════════════════════════

app.post('/share', async (req, res) => {
  const { userId, fileId, shareDuration, oneTime } = req.body;
  const ip = getClientIp(req);
  try {
    const file = await File.findOne({ _id: fileId, userId });
    if (!file) return res.status(404).json({ error: 'File not found or unauthorized.' });

    const shareExpiryMs = {
  '2m':  2  * 60 * 1000,
  '5m':  5  * 60 * 1000,
  '1h':  60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};;
    const ms             = shareExpiryMs[shareDuration] || 24 * 60 * 60 * 1000;
    const shareExpiresAt = new Date(Date.now() + ms);
    const shareToken     = crypto.randomBytes(24).toString('hex');
    file.shareToken      = shareToken;
    file.shareExpiresAt  = shareExpiresAt;
    file.oneTimeDownload = oneTime === true || oneTime === 'true';
    await file.save();

    await log('SHARE_GENERATED', { userId, fileId: file._id, filename: file.originalName, ip, details: `Duration: ${shareDuration}, one-time: ${file.oneTimeDownload}` });

    res.status(200).json({ shareToken, shareLink: `http://localhost:3000/shared/${shareToken}`, shareExpiresAt, oneTime: file.oneTimeDownload });
  } catch (err) { res.status(500).json({ error: 'Error generating share link.' }); }
});

app.get('/shared/:token', async (req, res) => {
  const ip = getClientIp(req);
  try {
    const file = await File.findOne({ shareToken: req.params.token });
    if (!file) return res.status(404).json({ error: 'Invalid or expired share link.' });
    if (!file.shareExpiresAt || new Date() > file.shareExpiresAt) {
      file.shareToken = undefined; file.shareExpiresAt = undefined;
      await file.save();
      return res.status(410).json({ error: 'This share link has expired.' });
    }
    if (file.expiresAt && new Date() > file.expiresAt) return res.status(410).json({ error: 'The file itself has expired.' });
    await log('SHARE_LINK_OPENED', { fileId: file._id, filename: file.originalName, ip });
    res.status(200).json({ filename: file.filename, originalName: file.originalName, iv: file.iv, shareExpiresAt: file.shareExpiresAt, oneTime: file.oneTimeDownload });
  } catch (err) { res.status(500).json({ error: 'Error accessing shared file.' }); }
});

app.post('/shared/:token/download', async (req, res) => {
  const { secretKey } = req.body; const ip = getClientIp(req);
  try {
    const file = await File.findOne({ shareToken: req.params.token });
    if (!file) return res.status(404).json({ error: 'Invalid share link.' });
    if (!file.shareExpiresAt || new Date() > file.shareExpiresAt) return res.status(410).json({ error: 'Share link has expired.' });

    const bfKey = `share-${file._id}`;
    if (!bruteForce[bfKey]) bruteForce[bfKey] = { count: 0, lockedUntil: null };
    const bf = bruteForce[bfKey];
    if (bf.lockedUntil && new Date() < bf.lockedUntil) {
      const secsLeft = Math.ceil((bf.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({ error: `Locked. Try again in ${secsLeft}s.`, lockedSeconds: secsLeft });
    }
    if (file.secretKey !== secretKey) {
      bf.count += 1;
      await log('WRONG_KEY', { fileId: file._id, filename: file.originalName, ip, success: false });
      if (bf.count >= 5) { bf.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); bf.count = 0; return res.status(429).json({ error: 'Locked for 15 minutes.', lockedSeconds: 900 }); }
      return res.status(403).json({ error: `Invalid key. ${5 - bf.count} attempts left.` });
    }
    bruteForce[bfKey] = { count: 0, lockedUntil: null };

    const encPath = path.join(UPLOADS_DIR, file.filename);
    const decPath = path.join(UPLOADS_DIR, `dec-${Date.now()}-${file.filename}`);
    await decryptFile(encPath, decPath, Buffer.from(secretKey, 'hex'), file.iv);
    await log('DOWNLOAD_SHARED', { fileId: file._id, filename: file.originalName, ip, details: `one-time: ${file.oneTimeDownload}` });

    if (file.oneTimeDownload) {
      file.shareToken = undefined; file.shareExpiresAt = undefined;
      await file.save();
    }
    res.download(decPath, file.originalName, () => { if (fs.existsSync(decPath)) fs.unlinkSync(decPath); });
  } catch (err) { res.status(500).json({ error: 'Error downloading shared file.' }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  AUDIT LOG FETCH
// ═════════════════════════════════════════════════════════════════════════════

app.get('/audit-log', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const userFiles = await File.find({ userId }).select('_id');
    const fileIds   = userFiles.map(f => f._id);
    const logs      = await AuditLog.find({ $or: [{ userId }, { fileId: { $in: fileIds } }] })
      .sort({ createdAt: -1 }).limit(100);
    res.status(200).json(logs);
  } catch (err) { res.status(500).json({ error: 'Error fetching audit logs.' }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  PREVIEW
// ═════════════════════════════════════════════════════════════════════════════

app.post('/preview/:filename', async (req, res) => {
  try {
    const { filename } = req.params; const { secretKey } = req.body;
    const file = await File.findOne({ filename });
    if (!file) return res.status(404).json({ error: 'File not found.' });
    if (file.expiresAt && new Date() > file.expiresAt) return res.status(410).json({ error: 'File has expired.' });

    const encPath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(encPath)) return res.status(404).json({ error: 'File missing on disk.' });

    const fd = fs.openSync(encPath, 'r'); const encBuf = Buffer.alloc(256);
    const encRead = fs.readSync(fd, encBuf, 0, 256, 0); fs.closeSync(fd);
    const encryptedHex = encBuf.slice(0, encRead).toString('hex').toUpperCase().match(/.{1,2}/g).join(' ');

    if (!secretKey) return res.status(200).json({ originalName: file.originalName, encryptedHex, decryptedText: null, keyRequired: true });
    if (file.secretKey !== secretKey) return res.status(403).json({ error: 'Invalid secret key.' });

    const tmpPath = path.join(UPLOADS_DIR, `prev-${Date.now()}-${filename}`);
    await decryptFile(encPath, tmpPath, Buffer.from(secretKey, 'hex'), file.iv);
    const fd2 = fs.openSync(tmpPath, 'r'); const decBuf = Buffer.alloc(1000);
    const decRead = fs.readSync(fd2, decBuf, 0, 1000, 0); fs.closeSync(fd2); fs.unlinkSync(tmpPath);

    const rawSlice = decBuf.slice(0, decRead);
    const nonPrint = rawSlice.filter(b => b < 9 || (b > 13 && b < 32));
    const isText   = nonPrint.length < rawSlice.length * 0.1;
    const decryptedText = isText ? rawSlice.toString('utf8').slice(0, 500) : `[Binary file]\nFirst bytes: ${rawSlice.slice(0, 64).toString('hex').toUpperCase().match(/.{1,2}/g).join(' ')}`;

    return res.status(200).json({ originalName: file.originalName, encryptedHex, decryptedText, isText, keyRequired: false });
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

app.get('/', (req, res) => res.send('LockBox API running'));
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));