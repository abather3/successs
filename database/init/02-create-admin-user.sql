-- Create admin user with default password
-- Password: admin123 (hashed with argon2)

INSERT INTO users (email, full_name, password_hash, role, status, created_at, updated_at) 
VALUES (
    'admin@escashop.com',
    'System Administrator',
    '$argon2id$v=19$m=65536,t=3,p=1$cm4QAbhLsLexS9VCv4oeFw$M/cyI82HfCUBa26PUDxZj5ciXK3CUfHnuJlvrvfyDBo',
    'admin',
    'active',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Log the creation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE email = 'admin@escashop.com') THEN
        RAISE NOTICE 'Admin user created successfully';
        RAISE NOTICE 'Email: admin@escashop.com';
        RAISE NOTICE 'Password: admin123';
    END IF;
END $$;
