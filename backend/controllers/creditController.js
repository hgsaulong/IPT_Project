const db = require('../db');

function badRequest(message) {
    return Object.assign(new Error(message), { status: 400 });
}

exports.getCustomers = async (req, res) => {
    const [customers] = await db.promise().query(
        `SELECT c.id, c.name, c.phone, c.address,
                COALESCE(credit.total_credit, 0) - COALESCE(payments.total_paid, 0) AS balance,
                DATE_FORMAT(credit.last_purchase, '%Y-%m-%d') AS lastPurchase
         FROM customers c
         JOIN (
             SELECT customer_id, SUM(total) AS total_credit, MAX(created_at) AS last_purchase
             FROM sales
             WHERE payment_method = 'Credit' AND customer_id IS NOT NULL
             GROUP BY customer_id
         ) credit ON credit.customer_id = c.id
         LEFT JOIN (
             SELECT customer_id, SUM(amount) AS total_paid
             FROM credit_payments
             GROUP BY customer_id
         ) payments ON payments.customer_id = c.id
         ORDER BY c.name`
    );
    res.json(customers.map((customer) => ({ ...customer, balance: Number(customer.balance) })));
};

exports.getCustomerHistory = async (req, res) => {
    const customerId = Number(req.params.customerId);
    if (!Number.isSafeInteger(customerId) || customerId < 1) throw badRequest('Invalid customer id.');

    const [rows] = await db.promise().execute(
        `SELECT activity.date, activity.description, activity.type, activity.amount
         FROM (
             SELECT s.created_at AS date,
                    CONCAT('Credit purchase · ', s.receipt_number) AS description,
                    'CREDIT' AS type,
                    s.total AS amount
             FROM sales s
             WHERE s.customer_id = ? AND s.payment_method = 'Credit'
             UNION ALL
             SELECT p.created_at AS date,
                    COALESCE(p.note, 'Payment received') AS description,
                    'PAYMENT' AS type,
                    -p.amount AS amount
             FROM credit_payments p
             WHERE p.customer_id = ?
         ) activity
         ORDER BY activity.date DESC`,
        [customerId, customerId]
    );
    res.json(rows);
};

exports.recordPayment = async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const customerId = Number(body.customerId);
    const cashierId = Number(req.user.userId);
    const amount = Number(body.amount);
    const note = typeof body.note === 'string' ? body.note.trim() : null;

    if (!Number.isSafeInteger(customerId) || customerId < 1 || !Number.isSafeInteger(cashierId) || cashierId < 1) {
        throw badRequest('A valid customer and cashier are required.');
    }
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) {
        throw badRequest('Enter a payment amount greater than zero with no more than two decimal places.');
    }
    if (note && note.length > 500) throw badRequest('Payment note must be 500 characters or fewer.');

    const connection = await db.promise().getConnection();
    let transactionStarted = false;
    try {
        await connection.beginTransaction();
        transactionStarted = true;

        const [customers] = await connection.execute(
            'SELECT id FROM customers WHERE id = ? FOR UPDATE',
            [customerId]
        );
        if (!customers.length) throw Object.assign(new Error('Customer not found.'), { status: 404 });

        const [balances] = await connection.execute(
            `SELECT
                COALESCE((SELECT SUM(total) FROM sales WHERE customer_id = ? AND payment_method = 'Credit'), 0)
                - COALESCE((SELECT SUM(amount) FROM credit_payments WHERE customer_id = ?), 0) AS balance`,
            [customerId, customerId]
        );
        const balanceCents = Math.round(Number(balances[0].balance) * 100);
        const paymentCents = Math.round(amount * 100);
        if (paymentCents > balanceCents) throw badRequest('Payment cannot exceed the customer’s outstanding balance.');

        const [result] = await connection.execute(
            'INSERT INTO credit_payments (customer_id, cashier_id, amount, note) VALUES (?, ?, ?, ?)',
            [customerId, cashierId, (paymentCents / 100).toFixed(2), note || null]
        );
        await connection.commit();
        transactionStarted = false;
        res.status(201).json({ id: result.insertId, customerId, amount: paymentCents / 100 });
    } catch (error) {
        if (transactionStarted) await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};
