const argon2 = require('argon2');

async function generateHash() {
    try {
        const password = 'admin123';
        const hash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 2 ** 16, // 64 MiB
            timeCost: 3,
            parallelism: 1
        });
        
        console.log('Password:', password);
        console.log('Hash:', hash);
        
        // Verify the hash works
        const isValid = await argon2.verify(hash, password);
        console.log('Hash verification:', isValid);
    } catch (error) {
        console.error('Error generating hash:', error);
    }
}

generateHash();
