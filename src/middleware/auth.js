const jwt = require('jsonwebtoken');
const User = require('../models/User');

function tokenFrom(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

async function loadUser(req) {
  const token = tokenFrom(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    return user && user.isActive ? user : null;
  } catch {
    return null; // invalid / expired / old local-fallback token
  }
}

// Sets req.user when a valid token is sent, but lets guests through.
exports.optionalAuth = async (req, res, next) => {
  try { req.user = await loadUser(req); next(); } catch (e) { next(e); }
};

exports.requireAuth = async (req, res, next) => {
  try {
    const user = await loadUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in to continue.' });
    req.user = user;
    next();
  } catch (e) { next(e); }
};

exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to do this.' });
  }
  next();
};
