const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');
const db = require('../db');

const uploadDirectory = path.join(__dirname, '..', '..', 'frontend', 'public', 'uploads', 'products');

const uploadProductImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            callback(new Error('Only JPEG, PNG, and WebP images are allowed.'));
            return;
        }
        callback(null, true);
    }
}).single('image');

function getImageType(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { mime: 'image/jpeg', extension: 'jpg' };
    }
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return { mime: 'image/png', extension: 'png' };
    }
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
        return { mime: 'image/webp', extension: 'webp' };
    }
    return null;
}

function invalidRequest(message) {
    return Object.assign(new Error(message), { status: 400 });
}

function parseProduct(body) {
    const categoryId = Number(body.category_id);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const price = Number(body.price);
    const stock = Number(body.stock);
    const threshold = body.low_stock_threshold === undefined || body.low_stock_threshold === ''
        ? 30
        : Number(body.low_stock_threshold);
    const barcode = typeof body.barcode === 'string' && body.barcode.trim()
        ? body.barcode.trim()
        : null;

    if (!Number.isSafeInteger(categoryId) || categoryId < 1) throw invalidRequest('Choose a valid category.');
    if (!name || name.length > 200) throw invalidRequest('Product name is required and must be 200 characters or fewer.');
    if (!Number.isFinite(price) || price < 0 || Math.round(price * 100) / 100 !== price) {
        throw invalidRequest('Enter a valid product price with no more than two decimal places.');
    }
    if (!Number.isSafeInteger(stock) || stock < 0) throw invalidRequest('Stock must be a non-negative whole number.');
    if (!Number.isSafeInteger(threshold) || threshold < 0) throw invalidRequest('Low-stock threshold must be a non-negative whole number.');
    if (barcode && barcode.length > 64) throw invalidRequest('Barcode must be 64 characters or fewer.');

    return { categoryId, name, price, stock, threshold, barcode };
}

async function saveProduct(req, res) {
    const product = parseProduct(req.body);
    let imageUrl = null;
    let savedImagePath = null;

    if (req.file) {
        const imageType = getImageType(req.file.buffer);
        if (!imageType || imageType.mime !== req.file.mimetype) {
            throw invalidRequest('The uploaded file is not a valid JPEG, PNG, or WebP image.');
        }

        await fs.promises.mkdir(uploadDirectory, { recursive: true });
        const filename = `${randomUUID()}.${imageType.extension}`;
        savedImagePath = path.join(uploadDirectory, filename);
        imageUrl = `/uploads/products/${filename}`;
        await fs.promises.writeFile(savedImagePath, req.file.buffer, { flag: 'wx' });
    }

    try {
        if (req.method === 'POST') {
            const [result] = await db.promise().execute(
                `INSERT INTO products
                    (category_id, name, barcode, price, stock, low_stock_threshold, image_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [product.categoryId, product.name, product.barcode, product.price, product.stock, product.threshold, imageUrl]
            );
            const [rows] = await db.promise().execute(
                `SELECT p.id, p.category_id, c.name AS category, p.name, p.barcode, p.price,
                        p.stock, p.low_stock_threshold, p.image_url, p.is_active
                 FROM products p JOIN categories c ON c.id = p.category_id
                 WHERE p.id = ?`,
                [result.insertId]
            );
            return res.status(201).json(rows[0]);
        }

        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) throw invalidRequest('Invalid product id.');
        const [result] = await db.promise().execute(
            `UPDATE products
             SET category_id = ?, name = ?, barcode = ?, price = ?, stock = ?,
                 low_stock_threshold = ?, image_url = COALESCE(?, image_url)
             WHERE id = ? AND is_active = TRUE`,
            [product.categoryId, product.name, product.barcode, product.price, product.stock, product.threshold, imageUrl, id]
        );
        if (!result.affectedRows) {
            const error = new Error('Product not found.');
            error.status = 404;
            throw error;
        }
        const [rows] = await db.promise().execute(
            `SELECT p.id, p.category_id, c.name AS category, p.name, p.barcode, p.price,
                    p.stock, p.low_stock_threshold, p.image_url, p.is_active
             FROM products p JOIN categories c ON c.id = p.category_id
             WHERE p.id = ?`,
            [id]
        );
        return res.json(rows[0]);
    } catch (error) {
        if (savedImagePath) await fs.promises.unlink(savedImagePath).catch((unlinkError) => {
            if (unlinkError.code !== 'ENOENT') console.error('Unable to remove unused uploaded image:', unlinkError);
        });
        if (error.code === 'ER_DUP_ENTRY') {
            error.status = 409;
            error.message = 'That barcode is already assigned to another product.';
        }
        throw error;
    }
}

exports.uploadProductImage = uploadProductImage;

exports.getCategories = async (req, res) => {
    const [categories] = await db.promise().query('SELECT id, name FROM categories ORDER BY name');
    res.json(categories);
};

exports.getProducts = async (req, res) => {
    const [products] = await db.promise().query(
        `SELECT p.id, p.category_id, c.name AS category, p.name, p.barcode, p.price,
                p.stock, p.low_stock_threshold, p.image_url, p.is_active
         FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = TRUE
         ORDER BY p.name`
    );
    res.json(products);
};

exports.createProduct = saveProduct;
exports.updateProduct = saveProduct;

exports.deleteProduct = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw invalidRequest('Invalid product id.');
    const [result] = await db.promise().execute(
        'UPDATE products SET is_active = FALSE WHERE id = ? AND is_active = TRUE',
        [id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
    res.status(204).end();
};
