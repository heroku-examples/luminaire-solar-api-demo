-- Create the 'weather' table
CREATE TABLE IF NOT EXISTS weather (
    zip TEXT NOT NULL,
    country TEXT NOT NULL,
    temperature INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at timestamp DEFAULT current_timestamp,
    updated_at timestamp DEFAULT current_timestamp,
    PRIMARY KEY (zip, country)
)