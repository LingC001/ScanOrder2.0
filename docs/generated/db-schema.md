# 数据库结构

由 PostgreSQL 18 临时实例重放迁移后生成，不连接开发数据库。迁移指纹：`32b3f3c421a76c20f10f99782be1277b0b22cd1d96cd2382e2381ae235ad51c2`。

| 表          | 列               | 类型                     | 可空 | 默认值            |
| ----------- | ---------------- | ------------------------ | ---- | ----------------- |
| foods       | id               | uuid                     | NO   | —                 |
| foods       | legacyId         | character varying(24)    | YES  | —                 |
| foods       | category         | character varying(50)    | NO   | —                 |
| foods       | name             | character varying(100)   | NO   | —                 |
| foods       | priceCents       | integer                  | NO   | —                 |
| foods       | description      | character varying(1000)  | NO   | —                 |
| foods       | imageUrl         | character varying(255)   | NO   | —                 |
| foods       | recommended      | boolean                  | NO   | —                 |
| foods       | createdAt        | timestamp with time zone | NO   | CURRENT_TIMESTAMP |
| order_items | id               | uuid                     | NO   | —                 |
| order_items | orderId          | uuid                     | NO   | —                 |
| order_items | foodId           | uuid                     | NO   | —                 |
| order_items | position         | integer                  | NO   | —                 |
| order_items | name             | character varying(100)   | NO   | —                 |
| order_items | imageUrl         | character varying(255)   | NO   | —                 |
| order_items | priceCents       | integer                  | NO   | —                 |
| order_items | quantity         | integer                  | NO   | —                 |
| order_items | totalAmountCents | bigint                   | NO   | —                 |
| orders      | id               | uuid                     | NO   | —                 |
| orders      | location         | character varying(100)   | NO   | —                 |
| orders      | tableNumber      | character varying(32)    | NO   | —                 |
| orders      | guestCount       | integer                  | NO   | —                 |
| orders      | comment          | character varying(50)    | NO   | —                 |
| orders      | totalAmountCents | bigint                   | NO   | —                 |
| orders      | totalQuantity    | integer                  | NO   | —                 |
| orders      | finished         | boolean                  | NO   | true              |
| orders      | createdAt        | timestamp with time zone | NO   | CURRENT_TIMESTAMP |
| orders      | updatedAt        | timestamp with time zone | NO   | CURRENT_TIMESTAMP |

## 约束

- foods / foods_category_not_null：`NOT NULL category`
- foods / foods_createdAt_not_null：`NOT NULL "createdAt"`
- foods / foods_description_not_null：`NOT NULL description`
- foods / foods_id_not_null：`NOT NULL id`
- foods / foods_imageUrl_not_null：`NOT NULL "imageUrl"`
- foods / foods_legacyId_key：`UNIQUE ("legacyId")`
- foods / foods_name_not_null：`NOT NULL name`
- foods / foods_pkey：`PRIMARY KEY (id)`
- foods / foods_priceCents_check：`CHECK ((("priceCents" >= 0) AND ("priceCents" <= 10000000)))`
- foods / foods_priceCents_not_null：`NOT NULL "priceCents"`
- foods / foods_recommended_not_null：`NOT NULL recommended`
- order_items / order_items_check：`CHECK (("totalAmountCents" = (("priceCents")::bigint * quantity)))`
- order_items / order_items_foodId_fkey：`FOREIGN KEY ("foodId") REFERENCES foods(id) ON DELETE RESTRICT`
- order_items / order_items_foodId_not_null：`NOT NULL "foodId"`
- order_items / order_items_id_not_null：`NOT NULL id`
- order_items / order_items_imageUrl_not_null：`NOT NULL "imageUrl"`
- order_items / order_items_name_not_null：`NOT NULL name`
- order_items / order_items_orderId_fkey：`FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE CASCADE`
- order_items / order_items_orderId_foodId_key：`UNIQUE ("orderId", "foodId")`
- order_items / order_items_orderId_not_null：`NOT NULL "orderId"`
- order_items / order_items_pkey：`PRIMARY KEY (id)`
- order_items / order_items_position_not_null：`NOT NULL "position"`
- order_items / order_items_priceCents_check：`CHECK ((("priceCents" >= 0) AND ("priceCents" <= 10000000)))`
- order_items / order_items_priceCents_not_null：`NOT NULL "priceCents"`
- order_items / order_items_quantity_check：`CHECK (((quantity >= 1) AND (quantity <= 999)))`
- order_items / order_items_quantity_not_null：`NOT NULL quantity`
- order_items / order_items_totalAmountCents_not_null：`NOT NULL "totalAmountCents"`
- orders / orders_comment_not_null：`NOT NULL comment`
- orders / orders_createdAt_not_null：`NOT NULL "createdAt"`
- orders / orders_finished_not_null：`NOT NULL finished`
- orders / orders_guestCount_check：`CHECK ((("guestCount" >= 1) AND ("guestCount" <= 5)))`
- orders / orders_guestCount_not_null：`NOT NULL "guestCount"`
- orders / orders_id_not_null：`NOT NULL id`
- orders / orders_location_not_null：`NOT NULL location`
- orders / orders_pkey：`PRIMARY KEY (id)`
- orders / orders_tableNumber_not_null：`NOT NULL "tableNumber"`
- orders / orders_totalAmountCents_check：`CHECK (("totalAmountCents" >= 0))`
- orders / orders_totalAmountCents_not_null：`NOT NULL "totalAmountCents"`
- orders / orders_totalQuantity_check：`CHECK (("totalQuantity" > 0))`
- orders / orders_totalQuantity_not_null：`NOT NULL "totalQuantity"`
- orders / orders_updatedAt_not_null：`NOT NULL "updatedAt"`

## 索引

- foods / foods_legacyId_key：`CREATE UNIQUE INDEX "foods_legacyId_key" ON public.foods USING btree ("legacyId")`
- foods / foods_pkey：`CREATE UNIQUE INDEX foods_pkey ON public.foods USING btree (id)`
- order_items / order_items_orderId_foodId_key：`CREATE UNIQUE INDEX "order_items_orderId_foodId_key" ON public.order_items USING btree ("orderId", "foodId")`
- order_items / order_items_order_idx：`CREATE INDEX order_items_order_idx ON public.order_items USING btree ("orderId")`
- order_items / order_items_pkey：`CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id)`
- orders / orders_created_at_idx：`CREATE INDEX orders_created_at_idx ON public.orders USING btree ("createdAt" DESC)`
- orders / orders_pkey：`CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)`
