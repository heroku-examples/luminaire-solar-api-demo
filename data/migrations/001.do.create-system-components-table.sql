-- Create the 'system_components' table
CREATE TABLE IF NOT EXISTS system_components (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id TEXT NOT NULL,
    FOREIGN KEY (system_id) REFERENCES systems(id),
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false
)