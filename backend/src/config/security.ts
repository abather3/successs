import { Pool, PoolConfig } from 'pg';

// Database security configuration
export const databaseSecurityConfig: PoolConfig = {
  // Connection settings
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'escashop',
  
  // Use least privilege database user
  user: process.env.DB_USER || 'escashop_app',
  password: process.env.DB_PASSWORD,
  
  // Connection pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  
  // Security settings
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // Query logging - enable in production for monitoring
  ...(process.env.NODE_ENV === 'production' && {
    log: (msg: string) => {
      // Log all queries for security monitoring
      console.log(`[DB Query]: ${msg}`);
    }
  })
};

// SQL injection prevention utilities
export class SQLSecurityHelper {
  /**
   * Validate and sanitize table/column names to prevent SQL injection
   */
  static validateIdentifier(identifier: string): boolean {
    // Only allow alphanumeric characters and underscores
    const regex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return regex.test(identifier);
  }

  /**
   * Escape SQL identifiers (table names, column names)
   */
  static escapeIdentifier(identifier: string): string {
    if (!this.validateIdentifier(identifier)) {
      throw new Error(`Invalid SQL identifier: ${identifier}`);
    }
    return `"${identifier}"`;
  }

  /**
   * Check if a query uses parameterized queries
   */
  static isParameterizedQuery(query: string): boolean {
    // Check for PostgreSQL parameter placeholders ($1, $2, etc.)
    const paramRegex = /\$\d+/g;
    const hasParams = paramRegex.test(query);
    
    // Check for dangerous concatenation patterns
    const dangerousPatterns = [
      /\+\s*['"`]/, // String concatenation
      /\$\{[^}]*\}/, // Template literals
      /concat\s*\(/i, // CONCAT function
      /\|\|\s*['"`]/ // SQL concatenation operator
    ];
    
    const hasDangerousPatterns = dangerousPatterns.some(pattern => pattern.test(query));
    
    return hasParams && !hasDangerousPatterns;
  }

  /**
   * Validate query before execution
   */
  static validateQuery(query: string, values?: any[]): void {
    // Check for basic SQL injection patterns
    const suspiciousPatterns = [
      /;\s*(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|TRUNCATE)/i,
      /UNION\s+SELECT/i,
      /--\s*$/m,
      /\/\*.*\*\//,
      /'\s*OR\s*'.*'=/i,
      /'\s*AND\s*'.*'=/i
    ];

    const hasSuspiciousPatterns = suspiciousPatterns.some(pattern => pattern.test(query));
    
    if (hasSuspiciousPatterns) {
      throw new Error('Potentially dangerous SQL query detected');
    }

    // Ensure parameterized queries are used
    if (!this.isParameterizedQuery(query) && values && values.length > 0) {
      console.warn('Query may not be properly parameterized:', query);
    }
  }
}

// Query wrapper with security checks
export class SecureQueryBuilder {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Execute a parameterized query with security validation
   */
  async query(text: string, params?: any[]): Promise<any> {
    try {
      // Validate query security
      SQLSecurityHelper.validateQuery(text, params);
      
      // Log query for monitoring (in production)
      if (process.env.NODE_ENV === 'production') {
        console.log(`[Secure Query]: ${text} | Params: ${params ? params.length : 0}`);
      }
      
      // Execute the query
      const result = await this.pool.query(text, params);
      
      return result;
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  }

  /**
   * Build a safe SELECT query with validated identifiers
   */
  select(table: string, columns: string[], where?: string, params?: any[]): Promise<any> {
    const safeTable = SQLSecurityHelper.escapeIdentifier(table);
    const safeColumns = columns.map(col => SQLSecurityHelper.escapeIdentifier(col)).join(', ');
    
    let query = `SELECT ${safeColumns} FROM ${safeTable}`;
    
    if (where) {
      query += ` WHERE ${where}`;
    }
    
    return this.query(query, params);
  }

  /**
   * Build a safe INSERT query with validated identifiers
   */
  insert(table: string, data: Record<string, any>): Promise<any> {
    const safeTable = SQLSecurityHelper.escapeIdentifier(table);
    const columns = Object.keys(data).map(col => SQLSecurityHelper.escapeIdentifier(col));
    const placeholders = Object.keys(data).map((_, index) => `$${index + 1}`);
    const values = Object.values(data);
    
    const query = `INSERT INTO ${safeTable} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    
    return this.query(query, values);
  }

  /**
   * Build a safe UPDATE query with validated identifiers
   */
  update(table: string, data: Record<string, any>, where: string, whereParams: any[]): Promise<any> {
    const safeTable = SQLSecurityHelper.escapeIdentifier(table);
    const setClause = Object.keys(data).map((col, index) => 
      `${SQLSecurityHelper.escapeIdentifier(col)} = $${index + 1}`
    ).join(', ');
    
    const values = [...Object.values(data), ...whereParams];
    const whereClauseParams = whereParams.map((_, index) => 
      where.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + Object.keys(data).length}`)
    );
    
    const query = `UPDATE ${safeTable} SET ${setClause} WHERE ${where} RETURNING *`;
    
    return this.query(query, values);
  }
}
