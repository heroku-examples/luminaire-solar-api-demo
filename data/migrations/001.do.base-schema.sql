-- Enable extension for UUID generation (if needed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the 'systems' table
CREATE TABLE IF NOT EXISTS systems (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    country TEXT NOT NULL
);

-- Create the 'metrics' table
CREATE TABLE IF NOT EXISTS metrics (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id TEXT NOT NULL,
    energy_consumed DECIMAL(10, 2) NOT NULL,
    energy_produced DECIMAL(10, 2) NOT NULL,
    datetime TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE
);

-- Create the 'users' table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    salt TEXT NOT NULL
);

-- Create the 'users_systems' table
CREATE TABLE IF NOT EXISTS users_systems (
    user_id TEXT NOT NULL,
    system_id TEXT NOT NULL,
    PRIMARY KEY (user_id, system_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE
);

-- Create the 'products' table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);