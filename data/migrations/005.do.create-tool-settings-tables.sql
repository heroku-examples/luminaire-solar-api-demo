-- Create the 'tool_settings' table
CREATE TABLE IF NOT EXISTS tool_settings (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    
    -- Tool enable/disable flags
    postgres_query_enabled BOOLEAN DEFAULT true,
    postgres_schema_enabled BOOLEAN DEFAULT true,
    html_to_markdown_enabled BOOLEAN DEFAULT true,
    pdf_to_markdown_enabled BOOLEAN DEFAULT true,
    code_exec_python_enabled BOOLEAN DEFAULT true,
    
    -- Cache settings
    schema_cache_enabled BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one settings row per user
    UNIQUE(user_id)
);

-- Create the 'whitelist_urls' table for html_to_markdown
CREATE TABLE IF NOT EXISTS whitelist_urls (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate URLs per user
    UNIQUE(user_id, url)
);

-- Create the 'whitelist_pdfs' table for pdf_to_markdown
CREATE TABLE IF NOT EXISTS whitelist_pdfs (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    pdf_url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate PDFs per user
    UNIQUE(user_id, pdf_url)
);

-- Create indexes for better query performance
CREATE INDEX idx_tool_settings_user_id ON tool_settings(user_id);
CREATE INDEX idx_whitelist_urls_user_id ON whitelist_urls(user_id);
CREATE INDEX idx_whitelist_pdfs_user_id ON whitelist_pdfs(user_id);

-- Insert default settings for existing users
INSERT INTO tool_settings (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

