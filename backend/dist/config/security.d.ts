import { Pool, PoolConfig } from 'pg';
export declare const databaseSecurityConfig: PoolConfig;
export declare class SQLSecurityHelper {
    /**
     * Validate and sanitize table/column names to prevent SQL injection
     */
    static validateIdentifier(identifier: string): boolean;
    /**
     * Escape SQL identifiers (table names, column names)
     */
    static escapeIdentifier(identifier: string): string;
    /**
     * Check if a query uses parameterized queries
     */
    static isParameterizedQuery(query: string): boolean;
    /**
     * Validate query before execution
     */
    static validateQuery(query: string, values?: any[]): void;
}
export declare class SecureQueryBuilder {
    private pool;
    constructor(pool: Pool);
    /**
     * Execute a parameterized query with security validation
     */
    query(text: string, params?: any[]): Promise<any>;
    /**
     * Build a safe SELECT query with validated identifiers
     */
    select(table: string, columns: string[], where?: string, params?: any[]): Promise<any>;
    /**
     * Build a safe INSERT query with validated identifiers
     */
    insert(table: string, data: Record<string, any>): Promise<any>;
    /**
     * Build a safe UPDATE query with validated identifiers
     */
    update(table: string, data: Record<string, any>, where: string, whereParams: any[]): Promise<any>;
}
//# sourceMappingURL=security.d.ts.map