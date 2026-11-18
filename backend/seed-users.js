require('dotenv').config();

const db = require('./db');
const bcrypt = require('bcryptjs');

const usernames = ['Owner', 'Saulong', 'De Vera', 'Delig', 'Pascualado', 'Liscano', 'Marie'];

function readHidden(prompt) {
    return new Promise((resolve, reject) => {
        const input = process.stdin;
        const output = process.stdout;
        if (!input.isTTY || typeof input.setRawMode !== 'function') {
            reject(new Error('Run this script from an interactive terminal so passwords are not echoed.'));
            return;
        }

        let value = '';
        const wasRaw = input.isRaw;
        output.write(prompt);
        input.setRawMode(true);
        input.resume();
        input.setEncoding('utf8');

        const cleanup = () => {
            input.removeListener('data', onData);
            input.setRawMode(wasRaw || false);
            output.write('\n');
        };

        const onData = (key) => {
            if (key === '\u0003') {
                cleanup();
                reject(new Error('Account setup cancelled.'));
            } else if (key === '\r' || key === '\n') {
                cleanup();
                resolve(value);
            } else if (key === '\u007f' || key === '\b') {
                value = value.slice(0, -1);
            } else if (key >= ' ') {
                value += key;
            }
        };

        input.on('data', onData);
    });
}

async function seedUsers() {
    const placeholders = usernames.map(() => '?').join(', ');
    const [existingRows] = await db.promise().execute(
        `SELECT LOWER(username) AS username FROM users WHERE LOWER(username) IN (${placeholders})`,
        usernames.map((username) => username.toLowerCase())
    );
    const existingUsernames = new Set(existingRows.map((row) => row.username));
    const missingUsernames = usernames.filter((username) => !existingUsernames.has(username.toLowerCase()));

    if (missingUsernames.length === 0) {
        await db.promise().execute(
            'UPDATE users SET role = CASE WHEN LOWER(username) IN (LOWER(?), LOWER(?)) THEN ? ELSE role END WHERE LOWER(username) IN (LOWER(?), LOWER(?))',
            ['Owner', 'Saulong', 'admin', 'Owner', 'Saulong']
        );
        await db.promise().execute(
            'UPDATE users SET role = ? WHERE LOWER(username) = LOWER(?)',
            ['cashier', 'Marie']
        );
        console.log('Owner is configured as admin and Marie as cashier. Existing passwords were not changed.');
        console.log('All requested accounts already exist. No passwords were changed.');
        return;
    }

    for (const username of missingUsernames) {
        const password = await readHidden(`Set password for ${username}: `);
        if (!password || password.length > 200) {
            throw new Error(`Password for ${username} must be between 1 and 200 characters.`);
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await db.promise().execute(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, passwordHash, ['Owner', 'Saulong'].includes(username) ? 'admin' : 'cashier']
        );
        console.log(`Saved hashed password for ${username}.`);
    }

    await db.promise().execute(
        'UPDATE users SET role = CASE WHEN LOWER(username) IN (LOWER(?), LOWER(?)) THEN ? WHEN LOWER(username) = LOWER(?) THEN ? ELSE role END WHERE LOWER(username) IN (LOWER(?), LOWER(?), LOWER(?))',
        ['Owner', 'Saulong', 'admin', 'Marie', 'cashier', 'Owner', 'Saulong', 'Marie']
    );
    console.log('All requested accounts are ready. Plaintext passwords were not stored.');
}

seedUsers()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => db.end());