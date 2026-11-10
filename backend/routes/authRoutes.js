const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { jwtSecret } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', async (req, res) => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!username || !password || username.length > 100 || password.length > 200) {
        return res.status(400).json({ message: 'Enter a valid username and password.' });
    }

    try {
        const [users] = await db.promise().execute(
            'SELECT id, username, password FROM users WHERE username = ? LIMIT 1',
            [username]
        );
        const user = users[0];
        const validPassword = user
            ? await bcrypt.compare(password, user.password)
            : await bcrypt.compare(password, '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7xE/8cPjX/EIk1kZtQb4QHh5D0Oa8Se');

        if (!user || !validPassword) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            jwtSecret,
            { expiresIn: '8h', issuer: 'bili-bili-pos' }
        );

        return res.json({
            token,
            user: { id: user.id, username: user.username },
        });
    } catch (error) {
        console.error('Login query failed:', error.message);
        return res.status(500).json({ message: 'Unable to sign in right now.' });
    }
});

module.exports = router;
