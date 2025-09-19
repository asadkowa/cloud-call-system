-- Initial database setup
CREATE DATABASE call_center;

-- Create user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'call_center_user') THEN

      CREATE ROLE call_center_user LOGIN PASSWORD 'secure_password';
   END IF;
END
$do$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE call_center TO call_center_user;