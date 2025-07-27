# Database Setup Instructions

## PostgreSQL Database Setup

1. **Connect to PostgreSQL as superuser:**
   ```bash
   psql -U postgres
   ```
   (You'll need the password you set during PostgreSQL installation)

2. **Create the database:**
   ```sql
   CREATE DATABASE escashop;
   ```

3. **Connect to the escashop database:**
   ```sql
   \c escashop
   ```

4. **Run the schema file:**
   ```sql
   \i database/schema.sql
   ```

   Or alternatively, run from command line:
   ```bash
   psql -U postgres -d escashop -f database/schema.sql
   ```

## Alternative: Create database with psql command line

```bash
# Create database
createdb -U postgres escashop

# Run schema
psql -U postgres -d escashop -f database/schema.sql
```

## Verify Database Setup

Connect to the database and verify tables were created:
```sql
psql -U postgres -d escashop
\dt
```

You should see all the tables listed (users, customers, transactions, etc.).

## Environment Configuration

Make sure your `.env` file has the correct database URL:
```
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/escashop
```

Replace `your_password` with the password you set during PostgreSQL installation.
