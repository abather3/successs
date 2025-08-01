import { SecureContextOptions } from 'tls';
export interface TLSConfig {
    cert?: string;
    key?: string;
    ca?: string;
    ciphers: string;
    secureProtocol: string;
    minVersion: string;
    maxVersion: string;
    honorCipherOrder: boolean;
    dhparam?: string;
}
export declare function createTLSConfig(): TLSConfig;
export declare function createSecureContextOptions(): SecureContextOptions;
export declare const SECURITY_HEADERS: {
    'Strict-Transport-Security': string;
    'X-Content-Type-Options': string;
    'X-Frame-Options': string;
    'X-XSS-Protection': string;
    'Referrer-Policy': string;
    'Content-Security-Policy': string;
};
export declare function validateTLSConfig(config: TLSConfig): boolean;
export declare function generateSelfSignedCertForDev(): string;
export declare const TLS_SECURITY_RECOMMENDATIONS: {
    certificate: {
        algorithm: string;
        validity: string;
        ca: string;
        san: string;
    };
    configuration: {
        protocols: string;
        ciphers: string;
        hsts: string;
        ocsp: string;
        pfs: string;
    };
    monitoring: {
        expiration: string;
        renewal: string;
        revocation: string;
        security: string;
    };
};
//# sourceMappingURL=tls.d.ts.map