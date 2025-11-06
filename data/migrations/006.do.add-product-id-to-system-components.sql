-- Add product_id column to system_components table
ALTER TABLE system_components
ADD COLUMN product_id TEXT,
ADD CONSTRAINT fk_system_components_product FOREIGN KEY (product_id) REFERENCES products(id);

