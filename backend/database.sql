CREATE DATABASE IF NOT EXISTS bili_bili
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE bili_bili;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'cashier') NOT NULL DEFAULT 'cashier',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB;


SET @user_role_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'role'
);
SET @user_role_ddl = IF(
    @user_role_exists = 0,
    'ALTER TABLE users ADD COLUMN role ENUM(''admin'', ''cashier'') NOT NULL DEFAULT ''cashier'' AFTER password',
    'SELECT 1'
);
PREPARE user_role_statement FROM @user_role_ddl;
EXECUTE user_role_statement;
DEALLOCATE PREPARE user_role_statement;

UPDATE users
SET role = 'admin'
WHERE LOWER(username) = LOWER('Saulong');

UPDATE users
SET role = 'admin'
WHERE LOWER(username) = LOWER('Owner');

UPDATE users
SET role = 'cashier'
WHERE LOWER(username) = LOWER('Marie');

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    barcode VARCHAR(64) NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT UNSIGNED NOT NULL DEFAULT 0,
    low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 30,
    image_url VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_products_barcode (barcode),
    KEY idx_products_category (category_id),
    KEY idx_products_name (name),
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    address VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_customers_name (name),
    KEY idx_customers_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    receipt_number VARCHAR(32) NOT NULL,
    cashier_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NULL,
    payment_method ENUM('Cash', 'GCash', 'Maya', 'Credit') NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    amount_tendered DECIMAL(10, 2) NULL,
    change_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sales_receipt_number (receipt_number),
    KEY idx_sales_created_at (created_at),
    KEY idx_sales_payment_method_created_at (payment_method, created_at),
    KEY idx_sales_customer (customer_id),
    KEY idx_sales_cashier (cashier_id),
    CONSTRAINT fk_sales_cashier
        FOREIGN KEY (cashier_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sales_customer
        FOREIGN KEY (customer_id) REFERENCES customers (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sale_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sale_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NULL,
    product_name VARCHAR(200) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    line_total DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_sale_items_sale (sale_id),
    KEY idx_sale_items_product (product_id),
    CONSTRAINT fk_sale_items_sale
        FOREIGN KEY (sale_id) REFERENCES sales (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_sale_items_product
        FOREIGN KEY (product_id) REFERENCES products (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS credit_payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    cashier_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_credit_payments_customer_created_at (customer_id, created_at),
    KEY idx_credit_payments_cashier (cashier_id),
    CONSTRAINT fk_credit_payments_customer
        FOREIGN KEY (customer_id) REFERENCES customers (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_credit_payments_cashier
        FOREIGN KEY (cashier_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Add image_url to products created by an earlier schema version.
SET @image_url_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'image_url'
);
SET @image_url_ddl = IF(
    @image_url_exists = 0,
    'ALTER TABLE products ADD COLUMN image_url VARCHAR(500) NULL AFTER low_stock_threshold',
    'SELECT 1'
);
PREPARE image_url_statement FROM @image_url_ddl;
EXECUTE image_url_statement;
DEALLOCATE PREPARE image_url_statement;

INSERT INTO categories (name) VALUES
    ('Rice & Grains'),
    ('Canned Goods'),
    ('Instant Noodles'),
    ('Snacks'),
    ('Beverages'),
    ('Dairy & Eggs'),
    ('Bread & Bakery'),
    ('Meat & Seafood'),
    ('Fruits & Vegetables'),
    ('Household & Personal Care')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Sample product images refer to files in frontend/public.
INSERT INTO products
    (category_id, name, barcode, price, stock, low_stock_threshold, image_url, is_active)
SELECT
    c.id, seed.name, seed.barcode, seed.price, seed.stock, 10, seed.image_url, TRUE
FROM (
    SELECT 'Rice & Grains' AS category, 'Harvester''s Dinorado Rice - 5 kg' AS name, 'BB-DEMO-001' AS barcode, 445.00 AS price, 40 AS stock, '/dinorado_rice.jpg' AS image_url
    UNION ALL SELECT 'Rice & Grains', 'Harvester''s Thai Jasmine Rice - 5 kg', 'BB-DEMO-002', 711.00, 30, '/jasmine_rice.jpg'
    UNION ALL SELECT 'Canned Goods', '555 Sardines in Tomato Sauce - 155 g', 'BB-DEMO-003', 23.00, 120, '/555 Sardines.jpg'
    UNION ALL SELECT 'Canned Goods', 'Purefoods Corned Beef - 210 g', 'BB-DEMO-004', 119.00, 55, '/purefoods cornbeef.jpg'
    UNION ALL SELECT 'Instant Noodles', 'Lucky Me! Chicken Noodles - 55 g', 'BB-DEMO-005', 10.00, 150, '/lucky me chicken.jpg'
    UNION ALL SELECT 'Instant Noodles', 'Lucky Me! Pancit Canton Chilimansi - 60 g', 'BB-DEMO-006', 13.00, 130, '/canton chilimansi.jpg'
    UNION ALL SELECT 'Snacks', 'Jack ''n Jill Piattos Cheese - 85 g', 'BB-DEMO-007', 34.00, 65, '/piattos cheese.jpg'
    UNION ALL SELECT 'Snacks', 'Jack ''n Jill Nova - 78 g', 'BB-DEMO-008', 38.00, 60, '/nova bbq.jpg'
    UNION ALL SELECT 'Beverages', 'C2 Green Tea Apple - 455 ml', 'BB-DEMO-009', 30.00, 80, '/c2 apple.jpg'
    UNION ALL SELECT 'Beverages', 'Coca-Cola Original Taste - 500 ml', 'BB-DEMO-010', 25.00, 90, '/coca-cola.jpg'
    UNION ALL SELECT 'Dairy & Eggs', 'Nestle Fresh Milk - 1 L', 'BB-DEMO-011', 125.00, 35, '/nestle fresh milk.jpg'
    UNION ALL SELECT 'Dairy & Eggs', 'Fresh Brown Eggs - 12 pcs', 'BB-DEMO-012', 126.00, 28, '/brown eggs.jpg'
    UNION ALL SELECT 'Bread & Bakery', 'Gardenia White Bread - 550 g', 'BB-DEMO-013', 80.00, 32, '/gardenia white bread.jpg'
    UNION ALL SELECT 'Bread & Bakery', 'Marby Cheese Bread - 250 g', 'BB-DEMO-014', 65.00, 24, '/marby cheese bread.jpg'
    UNION ALL SELECT 'Meat & Seafood', 'Purefoods Tender Juicy Hotdog - 500 g', 'BB-DEMO-015', 141.00, 25, '/tender juicy.jpg'
    UNION ALL SELECT 'Meat & Seafood', 'Frozen Bangus - 1 kg', 'BB-DEMO-016', 271.00, 18, '/frozen bangus.jpg'
    UNION ALL SELECT 'Fruits & Vegetables', 'Lakatan Banana - 1 kg', 'BB-DEMO-017', 100.00, 45, '/lakatan banana.jpg'
    UNION ALL SELECT 'Fruits & Vegetables', 'Fresh Tomatoes - 1 kg', 'BB-DEMO-018', 111.00, 35, '/Fresh tomatoes.jpg'
    UNION ALL SELECT 'Household & Personal Care', 'Safeguard Lemon Fresh Soap - 130 g', 'BB-DEMO-019', 48.00, 50, '/safeguard lemon.jpg'
    UNION ALL SELECT 'Household & Personal Care', 'Surf Detergent Powder - 1 kg', 'BB-DEMO-020', 125.00, 35, '/surf detergent.jpg'
) AS seed
JOIN categories c ON c.name = seed.category
ON DUPLICATE KEY UPDATE image_url = VALUES(image_url);

-- Synthetic sample customers for development/demo use.
INSERT INTO customers (name, phone, address)
SELECT seed.name, seed.phone, seed.address
FROM (
    SELECT 'Maria Santos' AS name, '09170000001' AS phone, '12 Mabini Street, Barangay San Isidro' AS address
    UNION ALL SELECT 'Jose Reyes', '09170000002', '45 Rizal Avenue, Barangay Poblacion'
    UNION ALL SELECT 'Rosario dela Cruz', '09170000003', '8 Sampaguita Street, Barangay San Roque'
    UNION ALL SELECT 'Antonio Bautista', '09170000004', '21 Maharlika Road, Barangay San Miguel'
    UNION ALL SELECT 'Lourdes Mendoza', '09170000005', '17 Bonifacio Street, Barangay San Isidro'
    UNION ALL SELECT 'Ramon Garcia', '09170000006', '6 Narra Street, Barangay Poblacion'
    UNION ALL SELECT 'Elena Fernandez', '09170000007', '33 Acacia Avenue, Barangay San Roque'
    UNION ALL SELECT 'Pedro Villanueva', '09170000008', '10 Kalayaan Street, Barangay San Miguel'
    UNION ALL SELECT 'Carmen Aquino', '09170000009', '28 Luna Street, Barangay San Isidro'
    UNION ALL SELECT 'Andres Castillo', '09170000010', '14 Mabuhay Road, Barangay Poblacion'
) AS seed
WHERE NOT EXISTS (
    SELECT 1 FROM customers existing WHERE existing.phone = seed.phone
);


DROP TEMPORARY TABLE IF EXISTS sample_sale_days;
CREATE TEMPORARY TABLE sample_sale_days (
    day_number INT UNSIGNED NOT NULL PRIMARY KEY
) ENGINE=MEMORY;

INSERT INTO sample_sale_days (day_number) VALUES
    (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
    (11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
    (21),(22),(23),(24),(25),(26),(27),(28),(29),(30),
    (31),(32),(33),(34),(35),(36),(37),(38),(39),(40),
    (41),(42),(43),(44),(45),(46),(47),(48),(49),(50),
    (51),(52),(53),(54),(55),(56),(57),(58),(59),(60);


DELETE FROM sales
WHERE (
    (receipt_number LIKE 'DEMO-___' AND CHAR_LENGTH(receipt_number) = 8)
    OR (receipt_number LIKE 'DEMO-HIST-___' AND CHAR_LENGTH(receipt_number) = 13)
)
AND EXISTS (SELECT 1 FROM users);

INSERT INTO sales
    (receipt_number, cashier_id, customer_id, payment_method, total, amount_tendered, change_amount, created_at)
SELECT
    CONCAT('DEMO-HIST-', LPAD(days.day_number, 3, '0')),
    cashier.id,
    CASE WHEN MOD(days.day_number, 4) = 3 THEN (
        SELECT MIN(c.id)
        FROM customers c
        WHERE c.phone = CONCAT('091700000', LPAD(MOD(days.day_number, 10) + 1, 2, '0'))
    ) ELSE NULL END,
    CASE MOD(days.day_number, 4)
        WHEN 0 THEN 'Cash'
        WHEN 1 THEN 'GCash'
        WHEN 2 THEN 'Maya'
        ELSE 'Credit'
    END,
    ROUND(first_product.price * (MOD(days.day_number, 3) + 1)
        + second_product.price * (MOD(days.day_number + 1, 2) + 1), 2),
    CASE WHEN MOD(days.day_number, 4) = 0 THEN
        ROUND(first_product.price * (MOD(days.day_number, 3) + 1)
            + second_product.price * (MOD(days.day_number + 1, 2) + 1) + 100, 2)
        ELSE NULL
    END,
    CASE WHEN MOD(days.day_number, 4) = 0 THEN 100.00 ELSE 0.00 END,
    DATE_SUB(CURRENT_DATE, INTERVAL days.day_number DAY) + INTERVAL 12 HOUR
FROM sample_sale_days days
JOIN users cashier ON cashier.id = (SELECT MIN(id) FROM users)
JOIN products first_product
    ON first_product.barcode = CONCAT('BB-DEMO-', LPAD(MOD(days.day_number, 20) + 1, 3, '0'))
JOIN products second_product
    ON second_product.barcode = CONCAT('BB-DEMO-', LPAD(MOD(days.day_number + 7, 20) + 1, 3, '0'))
WHERE NOT EXISTS (
    SELECT 1 FROM sales existing
    WHERE existing.receipt_number = CONCAT('DEMO-HIST-', LPAD(days.day_number, 3, '0'))
);

INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, line_total)
SELECT
    s.id, p.id, p.name, p.price, MOD(days.day_number, 3) + 1,
    ROUND(p.price * (MOD(days.day_number, 3) + 1), 2)
FROM sample_sale_days days
JOIN sales s ON s.receipt_number = CONCAT('DEMO-HIST-', LPAD(days.day_number, 3, '0'))
JOIN products p
    ON p.barcode = CONCAT('BB-DEMO-', LPAD(MOD(days.day_number, 20) + 1, 3, '0'))
WHERE NOT EXISTS (
    SELECT 1 FROM sale_items existing
    WHERE existing.sale_id = s.id AND existing.product_id = p.id
);

INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, line_total)
SELECT
    s.id, p.id, p.name, p.price, MOD(days.day_number + 1, 2) + 1,
    ROUND(p.price * (MOD(days.day_number + 1, 2) + 1), 2)
FROM sample_sale_days days
JOIN sales s ON s.receipt_number = CONCAT('DEMO-HIST-', LPAD(days.day_number, 3, '0'))
JOIN products p
    ON p.barcode = CONCAT('BB-DEMO-', LPAD(MOD(days.day_number + 7, 20) + 1, 3, '0'))
WHERE NOT EXISTS (
    SELECT 1 FROM sale_items existing
    WHERE existing.sale_id = s.id AND existing.product_id = p.id
);

DROP TEMPORARY TABLE sample_sale_days;
