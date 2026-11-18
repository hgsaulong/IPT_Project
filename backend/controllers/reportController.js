const db = require('../db');

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatSqlDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

function parseDateInput(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime())
        || date.getFullYear() !== year
        || date.getMonth() !== month - 1
        || date.getDate() !== day
        ? null
        : date;
}

function getRange(range, startDate, endDate) {
    if (range === 'Custom') {
        const start = parseDateInput(startDate);
        const selectedEnd = parseDateInput(endDate);
        if (!start || !selectedEnd || start > selectedEnd) {
            throw Object.assign(new Error('Choose a valid custom date range.'), { status: 400 });
        }
        selectedEnd.setDate(selectedEnd.getDate() + 1);
        return [formatSqlDate(start), formatSqlDate(selectedEnd)];
    }

    const now = new Date();
    const end = startOfDay(now);
    end.setDate(end.getDate() + 1);
    let start;

    switch (range) {
        case 'Today':
            start = startOfDay(now);
            break;
        case 'This Week': {
            start = startOfDay(now);
            start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
            break;
        }
        case 'This Month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        default:
            throw Object.assign(new Error('Choose a valid sales report range.'), { status: 400 });
    }

    return [formatSqlDate(start), formatSqlDate(end)];
}

exports.getSalesReport = async (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : 'Today';
    const [start, end] = getRange(range, req.query.startDate, req.query.endDate);
    const parameters = [start, end];

    const [summaryRows] = await db.promise().execute(
        `SELECT COALESCE(SUM(total), 0) AS totalSales,
                COUNT(*) AS transactions,
                COALESCE(AVG(total), 0) AS averageBasket
         FROM sales
         WHERE created_at >= ? AND created_at < ?`,
        parameters
    );
    const [paymentRows] = await db.promise().execute(
        `SELECT payment_method AS name, SUM(total) AS amount, COUNT(*) AS transactions
         FROM sales
         WHERE created_at >= ? AND created_at < ?
         GROUP BY payment_method
         ORDER BY FIELD(payment_method, 'Cash', 'GCash', 'Maya', 'Credit')`,
        parameters
    );

    // Daily aggregation used by the report chart, including the selected period's endpoints.
    const [dailyRows] = await db.promise().execute(
        `SELECT DATE(created_at) AS date, SUM(total) AS total, COUNT(*) AS transactions
         FROM sales
         WHERE created_at >= ? AND created_at < ?
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at)`,
        parameters
    );
    const [monthlyRows] = await db.promise().execute(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total) AS total, COUNT(*) AS transactions
         FROM sales
         WHERE created_at >= ? AND created_at < ?
         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
         ORDER BY month`,
        parameters
    );
    const [topProductRows] = await db.promise().execute(
        `SELECT si.product_name AS name,
                SUM(si.quantity) AS quantity,
                SUM(si.line_total) AS total
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE s.created_at >= ? AND s.created_at < ?
         GROUP BY si.product_id, si.product_name
         ORDER BY quantity DESC, total DESC, name
         LIMIT 10`,
        parameters
    );
    const [allTimeRows] = await db.promise().query(
        'SELECT COALESCE(SUM(total), 0) AS total FROM sales WHERE created_at >= CURRENT_DATE - INTERVAL 6 DAY'
    );

    res.json({
        range,
        start,
        end,
        summary: {
            totalSales: Number(summaryRows[0].totalSales),
            transactions: Number(summaryRows[0].transactions),
            averageBasket: Number(summaryRows[0].averageBasket),
            weeklyTotal: Number(allTimeRows[0].total)
        },
        paymentMethods: paymentRows.map((row) => ({
            ...row,
            amount: Number(row.amount),
            transactions: Number(row.transactions)
        })),
        dailySales: dailyRows.map((row) => ({
            date: row.date,
            total: Number(row.total),
            transactions: Number(row.transactions)
        })),
        monthlySales: monthlyRows.map((row) => ({
            month: row.month,
            total: Number(row.total),
            transactions: Number(row.transactions)
        }))
        ,
        topProducts: topProductRows.map((row) => ({
            name: row.name,
            quantity: Number(row.quantity),
            total: Number(row.total)
        }))
    });
};
