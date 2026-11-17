import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1780000000000 implements MigrationInterface {
  name = 'Initial1780000000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE foods (
        id uuid PRIMARY KEY,
        "legacyId" varchar(24) UNIQUE,
        category varchar(50) NOT NULL,
        name varchar(100) NOT NULL,
        "priceCents" integer NOT NULL CHECK ("priceCents" BETWEEN 0 AND 10000000),
        description varchar(1000) NOT NULL,
        "imageUrl" varchar(255) NOT NULL,
        recommended boolean NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE orders (
        id uuid PRIMARY KEY,
        location varchar(100) NOT NULL,
        "tableNumber" varchar(32) NOT NULL,
        "guestCount" integer NOT NULL CHECK ("guestCount" BETWEEN 1 AND 5),
        comment varchar(50) NOT NULL,
        "totalAmountCents" bigint NOT NULL CHECK ("totalAmountCents" >= 0),
        "totalQuantity" integer NOT NULL CHECK ("totalQuantity" > 0),
        finished boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX orders_created_at_idx ON orders ("createdAt" DESC);
      CREATE TABLE order_items (
        id uuid PRIMARY KEY,
        "orderId" uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        "foodId" uuid NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
        position integer NOT NULL,
        name varchar(100) NOT NULL,
        "imageUrl" varchar(255) NOT NULL,
        "priceCents" integer NOT NULL CHECK ("priceCents" BETWEEN 0 AND 10000000),
        quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 999),
        "totalAmountCents" bigint NOT NULL CHECK ("totalAmountCents" = "priceCents"::bigint * quantity),
        UNIQUE ("orderId", "foodId")
      );
      CREATE INDEX order_items_order_idx ON order_items ("orderId");
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE order_items; DROP TABLE orders; DROP TABLE foods;');
  }
}
