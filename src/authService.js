const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const TOKEN_TTL = '7d';

function getSecret() {
  return process.env.JWT_SECRET || 'voyanta-dev-secret';
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, getSecret(), {
    expiresIn: TOKEN_TTL,
  });
}

function registerUser(db, payload) {
  const name = String(payload?.name || '').trim();
  const email = String(payload?.email || '').trim().toLowerCase();
  const password = String(payload?.password || '');

  const errors = [];
  if (name.length < 2) {
    errors.push('Name must be at least 2 characters.');
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.push('Email must be valid.');
  }
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  }
  if (errors.length > 0) {
    return { ok: false, status: 400, errors };
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return { ok: false, status: 409, errors: ['Email is already registered.'] };
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, passwordHash, createdAt) VALUES (?, ?, ?, ?)')
    .run(name, email, passwordHash, new Date().toISOString());

  const user = db.prepare('SELECT id, name, email, createdAt FROM users WHERE id = ?').get(result.lastInsertRowid);
  return { ok: true, status: 201, user: sanitizeUser(user), token: issueToken(user) };
}

function loginUser(db, payload) {
  const email = String(payload?.email || '').trim().toLowerCase();
  const password = String(payload?.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return { ok: false, status: 401, errors: ['Invalid email or password.'] };
  }

  return {
    ok: true,
    status: 200,
    user: sanitizeUser(user),
    token: issueToken(user),
  };
}

function authMiddleware(db) {
  return (req, _res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = header.slice('Bearer '.length);
    try {
      const decoded = jwt.verify(token, getSecret());
      const user = db
        .prepare('SELECT id, name, email, createdAt FROM users WHERE id = ?')
        .get(decoded.sub);
      req.user = sanitizeUser(user);
      return next();
    } catch (_error) {
      req.user = null;
      return next();
    }
  };
}

module.exports = {
  registerUser,
  loginUser,
  authMiddleware,
};
