CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'manager'
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    current_price NUMERIC(10,2),
    cost_price NUMERIC(10,2),
    stock INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sales_records (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(150),
    units_sold INTEGER,
    revenue NUMERIC(12,2),
    price NUMERIC(10,2)
);
