-- Add 'battery_storage' field to systems table
ALTER TABLE systems 
ADD battery_storage INTEGER NOT NULL DEFAULT 0
