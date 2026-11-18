const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const jwtSecret = process.env.AUTH_TOKEN_SECRET || crypto.randomBytes(64).toString('hex');

function authenticateToken(req, res, next) {
    const authorization = req.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    try {
        req.user = jwt.verify(token, jwtSecret, { issuer: 'bili-bili-pos' });
        return next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired session.' });
    }
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Administrator access is required.' });
    }
    return next();
}

module.exports = { authenticateToken, requireAdmin, jwtSecret };
