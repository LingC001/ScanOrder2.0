import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMerchantAdmin1785000000000 implements MigrationInterface {
  name = 'AddMerchantAdmin1785000000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE categories (
        id uuid PRIMARY KEY,
        name varchar(50) NOT NULL UNIQUE,
        "sortOrder" integer NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO categories (id, name, "sortOrder")
      SELECT gen_random_uuid(), category_name, ROW_NUMBER() OVER (ORDER BY category_name)
      FROM (
        SELECT DISTINCT COALESCE(NULLIF(BTRIM(category), ''), '未分类') AS category_name
        FROM foods
      ) existing_categories;

      ALTER TABLE foods ADD COLUMN "categoryId" uuid;
      UPDATE foods AS food
      SET "categoryId" = category.id
      FROM categories AS category
      WHERE category.name = COALESCE(NULLIF(BTRIM(food.category), ''), '未分类');
      ALTER TABLE foods
        ALTER COLUMN "categoryId" SET NOT NULL,
        ADD CONSTRAINT foods_category_fk
          FOREIGN KEY ("categoryId") REFERENCES categories(id) ON DELETE RESTRICT;
      CREATE INDEX foods_category_idx ON foods ("categoryId");

      ALTER TABLE foods
        ADD COLUMN status varchar(16) NOT NULL DEFAULT 'inactive',
        ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ADD CONSTRAINT foods_status_check CHECK (status IN ('active', 'inactive', 'archived'));
      UPDATE foods SET status = 'active';
      ALTER TABLE foods DROP COLUMN category;

      ALTER TABLE orders
        ADD COLUMN "customerId" varchar(64),
        ADD COLUMN status varchar(16);
      UPDATE orders SET status = CASE WHEN finished THEN 'completed' ELSE 'pending' END;
      ALTER TABLE orders
        ALTER COLUMN status SET NOT NULL,
        ALTER COLUMN status SET DEFAULT 'pending',
        ADD CONSTRAINT orders_status_check
          CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled'));
      CREATE INDEX orders_customer_created_idx ON orders ("customerId", "createdAt" DESC);
      ALTER TABLE orders DROP COLUMN finished;

      CREATE TABLE sessions (
        id uuid PRIMARY KEY,
        "tokenHash" char(64) NOT NULL UNIQUE,
        kind varchar(16) NOT NULL CHECK (kind IN ('merchant', 'customer')),
        "principalId" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX sessions_expires_idx ON sessions ("expiresAt");
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      DROP TABLE sessions;

      ALTER TABLE orders
        ADD COLUMN finished boolean NOT NULL DEFAULT true;
      UPDATE orders SET finished = (status = 'completed');
      ALTER TABLE orders
        DROP CONSTRAINT orders_status_check,
        DROP COLUMN status,
        DROP COLUMN "customerId";

      ALTER TABLE foods ADD COLUMN category varchar(50);
      UPDATE foods AS food
      SET category = category.name
      FROM categories AS category
      WHERE category.id = food."categoryId";
      ALTER TABLE foods
        ALTER COLUMN category SET NOT NULL,
        DROP CONSTRAINT foods_status_check,
        DROP COLUMN status,
        DROP COLUMN "updatedAt",
        DROP COLUMN "categoryId";
      DROP TABLE categories;
    `);
  }
}
