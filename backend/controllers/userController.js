const bcrypt = require('bcryptjs');
const db = require('../db');

function badRequest(message) {
    return Object.assign(new Error(message), { status: 400 });
}

function parseUser(body) {
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role = body.role;

    if (!username || username.length > 100) throw badRequest('Username is required and must be 100 characters or fewer.');
    if (!password || password.length > 200) throw badRequest('Password is required and must be 200 characters or fewer.');
    if (!['admin', 'cashier'].includes(role)) throw badRequest('Choose a valid user role.');
    return { username, password, role };
}

exports.listUsers = async (req, res) => {
    const [users] = await db.promise().query(
        'SELECT id, username, role, created_at FROM users ORDER BY username'
    );
    res.json(users);
};

exports.createUser = async (req, res) => {
    const user = parseUser(req.body || {});
    try {
        const passwordHash = await bcrypt.hash(user.password, 12);
        const [result] = await db.promise().execute(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [user.username, passwordHash, user.role]
        );
        res.status(201).json({ id: result.insertId, username: user.username, role: user.role });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            error.status = 409;
            error.message = 'That username is already in use.';
        }
        throw error;
    }
};

exports.updateUser = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw badRequest('Invalid user id.');
    const { role, password } = req.body || {};
    if (!['admin', 'cashier'].includes(role)) throw badRequest('Choose a valid user role.');
    if (password !== undefined && (typeof password !== 'string' || !password || password.length > 200)) {
        throw badRequest('Password must be between 1 and 200 characters.');
    }

    const fields = ['role = ?'];
    const values = [role];
    if (password !== undefined) {
        fields.push('password = ?');
        values.push(await bcrypt.hash(password, 12));
    }
    values.push(id);
    const [result] = await db.promise().execute(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
    if (!result.affectedRows) {
        return res.status(404).json({ message: 'User not found.' });
    }
    const [rows] = await db.promise().execute(
        'SELECT id, username, role, created_at FROM users WHERE id = ?',
        [id]
    );
    res.json(rows[0]);
};

exports.deleteUser = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw badRequest('Invalid user id.');
    if (id === Number(req.user.userId)) throw badRequest('You cannot remove your own account.');
    const [result] = await db.promise().execute('DELETE FROM users WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
    res.status(204).end();
};
