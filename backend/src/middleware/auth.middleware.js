const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ status: 'error', message: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains id, role, etc.
    next();
  } catch (ex) {
    res.status(400).json({ status: 'error', message: 'Invalid token.' });
  }
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Access denied. You do not have permission.' });
    }
    next();
  };
};

const rateLimit = require('express-rate-limit');

const loginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many login attempts. Please try again after 5 minutes.' }
});

module.exports = {
  authenticateToken,
  authorizeRole,
  loginRateLimiter
};
