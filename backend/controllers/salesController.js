const { randomUUID } = require('crypto');
const db = require('../db');

function badRequest(message) {
    return Object.assign(new Error(message), { status: 400 });
}

function moneyToCents(value) {
    return Math.round(Number(value) * 100);
}

exports.createSale = async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { items, paymentMethod, amountTendered, customer } = body;
    const cashierId = Number(req.user.userId);

    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
        throw badRequest('A sale must include between 1 and 100 products.');
    }
    if (!['Cash', 'GCash', 'Maya', 'Credit'].includes(paymentMethod)) {
        throw badRequest('Choose a valid payment method.');
    }
    if (!Number.isSafeInteger(cashierId) || cashierId < 1) {
        throw Object.assign(new Error('The cashier session is invalid.'), { status: 401 });
    }

    const quantities = new Map();
    for (const item of items) {
        const productId = Number(item.productId);
        const quantity = Number(item.quantity);
        if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) {
            throw badRequest('Each sale item must have a valid product and quantity.');
        }
        quantities.set(productId, (quantities.get(productId) || 0) + quantity);
        if (quantities.get(productId) > 10000) throw badRequest('Requested quantity is too large.');
    }

    if (paymentMethod === 'Credit') {
        if (!customer || !['name', 'phone', 'address'].every((field) => typeof customer[field] === 'string' && customer[field].trim())) {
            throw badRequest('Name, phone, and address are required for credit sales.');
        }
        if (customer.name.trim().length > 200 || customer.phone.trim().length > 32 || customer.address.trim().length > 500) {
            throw badRequest('Credit customer details are too long.');
        }
    }

    const connection = await db.promise().getConnection();
    let transactionStarted = false;
    try {
        await connection.beginTransaction();
        transactionStarted = true;

        const productIds = [...quantities.keys()];
        const placeholders = productIds.map(() => '?').join(', ');
        const [products] = await connection.execute(
            `SELECT id, name, price, stock
             FROM products
             WHERE is_active = TRUE AND id IN (${placeholders})
             FOR UPDATE`,
            productIds
        );
        if (products.length !== productIds.length) throw badRequest('One or more products are unavailable.');

        const productById = new Map(products.map((product) => [String(product.id), product]));
        let totalCents = 0;
        const saleItems = productIds.map((id) => {
            const product = productById.get(String(id));
            const quantity = quantities.get(id);
            if (Number(product.stock) < quantity) {
                throw badRequest(`Not enough stock for ${product.name}.`);
            }
            const unitPriceCents = moneyToCents(product.price);
            const lineTotalCents = unitPriceCents * quantity;
            totalCents += lineTotalCents;
            return { product, quantity, unitPriceCents, lineTotalCents };
        });

        let tenderedCents = null;
        let changeCents = 0;
        if (paymentMethod === 'Cash') {
            tenderedCents = moneyToCents(amountTendered);
            if (!Number.isSafeInteger(tenderedCents) || tenderedCents < totalCents) {
                throw badRequest('Cash tendered must cover the sale total.');
            }
            changeCents = tenderedCents - totalCents;
        }

        let customerId = null;
        if (paymentMethod === 'Credit') {
            const normalizedPhone = customer.phone.trim();
            const [existingCustomers] = await connection.execute(
                'SELECT id FROM customers WHERE phone = ? ORDER BY id LIMIT 1 FOR UPDATE',
                [normalizedPhone]
            );
            if (existingCustomers.length) {
                customerId = existingCustomers[0].id;
                await connection.execute(
                    'UPDATE customers SET name = ?, address = ? WHERE id = ?',
                    [customer.name.trim(), customer.address.trim(), customerId]
                );
            } else {
                const [customerResult] = await connection.execute(
                    'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)',
                    [customer.name.trim(), normalizedPhone, customer.address.trim()]
                );
                customerId = customerResult.insertId;
            }
        }

        const receiptNumber = `BB-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const [saleResult] = await connection.execute(
            `INSERT INTO sales
                (receipt_number, cashier_id, customer_id, payment_method, total, amount_tendered, change_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                receiptNumber,
                cashierId,
                customerId,
                paymentMethod,
                (totalCents / 100).toFixed(2),
                tenderedCents === null ? null : (tenderedCents / 100).toFixed(2),
                (changeCents / 100).toFixed(2)
            ]
        );

        for (const item of saleItems) {
            await connection.execute(
                `INSERT INTO sale_items
                    (sale_id, product_id, product_name, unit_price, quantity, line_total)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    saleResult.insertId,
                    item.product.id,
                    item.product.name,
                    (item.unitPriceCents / 100).toFixed(2),
                    item.quantity,
                    (item.lineTotalCents / 100).toFixed(2)
                ]
            );
            await connection.execute(
                'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
                [item.quantity, item.product.id, item.quantity]
            );
        }

        await connection.commit();
        transactionStarted = false;

        res.status(201).json({
            id: saleResult.insertId,
            receipt_number: receiptNumber,
            created_at: new Date().toISOString(),
            total: (totalCents / 100).toFixed(2),
            payment_method: paymentMethod,
            amount_tendered: tenderedCents === null ? null : (tenderedCents / 100).toFixed(2),
            change_amount: (changeCents / 100).toFixed(2),
            customer: paymentMethod === 'Credit' ? {
                name: customer.name.trim(),
                phone: customer.phone.trim()
            } : null,
            items: saleItems.map((item) => ({
                product_id: item.product.id,
                product_name: item.product.name,
                unit_price: (item.unitPriceCents / 100).toFixed(2),
                quantity: item.quantity,
                line_total: (item.lineTotalCents / 100).toFixed(2)
            }))
        });
    } catch (error) {
        if (transactionStarted) await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};
