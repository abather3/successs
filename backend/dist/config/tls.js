"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TLS_SECURITY_RECOMMENDATIONS = exports.SECURITY_HEADERS = void 0;
exports.createTLSConfig = createTLSConfig;
exports.createSecureContextOptions = createSecureContextOptions;
exports.validateTLSConfig = validateTLSConfig;
exports.generateSelfSignedCertForDev = generateSelfSignedCertForDev;
const fs_1 = require("fs");
// Modern cipher suites in order of preference
const MODERN_CIPHER_SUITES = [
    // TLS 1.3 cipher suites (preferred)
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
    // TLS 1.2 cipher suites (fallback)
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-SHA384',
    'ECDHE-RSA-AES256-SHA384',
    'ECDHE-ECDSA-AES128-SHA256',
    'ECDHE-RSA-AES128-SHA256'
];
function createTLSConfig() {
    const config = {
        // Modern cipher suites only
        ciphers: MODERN_CIPHER_SUITES.join(':'),
        // TLS protocol versions
        secureProtocol: 'TLSv1_2_method',
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        // Honor cipher order for security
        honorCipherOrder: true
    };
    // Load certificates if available
    try {
        const certPath = process.env.TLS_CERT_PATH || './certs/server.crt';
        const keyPath = process.env.TLS_KEY_PATH || './certs/server.key';
        const caPath = process.env.TLS_CA_PATH || './certs/ca.crt';
        const dhparamPath = process.env.TLS_DHPARAM_PATH || './certs/dhparam.pem';
        if (certPath && keyPath) {
            config.cert = (0, fs_1.readFileSync)(certPath, 'utf8');
            config.key = (0, fs_1.readFileSync)(keyPath, 'utf8');
        }
        if (caPath) {
            try {
                config.ca = (0, fs_1.readFileSync)(caPath, 'utf8');
            }
            catch (error) {
                console.warn('CA certificate not found, continuing without it');
            }
        }
        if (dhparamPath) {
            try {
                config.dhparam = (0, fs_1.readFileSync)(dhparamPath, 'utf8');
            }
            catch (error) {
                console.warn('DH parameters not found, continuing without them');
            }
        }
    }
    catch (error) {
        console.error('Error loading TLS certificates:', error);
        throw new Error('Failed to load TLS configuration');
    }
    return config;
}
function createSecureContextOptions() {
    return {
        ciphers: MODERN_CIPHER_SUITES.join(':'),
        honorCipherOrder: true,
        secureProtocol: 'TLSv1_2_method',
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3'
    };
}
// Security headers to be added to all responses
exports.SECURITY_HEADERS = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: https:; frame-ancestors 'none';"
};
// Validate TLS configuration
function validateTLSConfig(config) {
    if (!config.cert || !config.key) {
        console.warn('TLS certificate or key not provided - using HTTP instead of HTTPS');
        return false;
    }
    // Check if certificates are properly formatted
    if (!config.cert.includes('BEGIN CERTIFICATE') || !config.key.includes('BEGIN PRIVATE KEY')) {
        console.error('Invalid certificate format');
        return false;
    }
    return true;
}
// Generate self-signed certificate for development (do not use in production)
function generateSelfSignedCertForDev() {
    return `
To generate a self-signed certificate for development, run:

# Generate private key
openssl genrsa -out server.key 2048

# Generate certificate signing request
openssl req -new -key server.key -out server.csr -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -in server.csr -signkey server.key -out server.crt -days 365

# Generate DH parameters (optional but recommended)
openssl dhparam -out dhparam.pem 2048

Place these files in a 'certs' directory in your project root.
`;
}
// TLS security best practices
exports.TLS_SECURITY_RECOMMENDATIONS = {
    certificate: {
        algorithm: 'RSA-2048 or ECDSA-256',
        validity: 'Maximum 90 days (use automated renewal)',
        ca: 'Use trusted CA like Let\'s Encrypt',
        san: 'Include all domain names in Subject Alternative Names'
    },
    configuration: {
        protocols: 'TLS 1.2 and 1.3 only',
        ciphers: 'Modern cipher suites only',
        hsts: 'Enable HTTP Strict Transport Security',
        ocsp: 'Enable OCSP stapling',
        pfs: 'Ensure Perfect Forward Secrecy'
    },
    monitoring: {
        expiration: 'Monitor certificate expiration',
        renewal: 'Automated certificate renewal',
        revocation: 'Monitor certificate revocation lists',
        security: 'Regular security audits'
    }
};
//# sourceMappingURL=tls.js.map