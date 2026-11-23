# 数据库结构

由 PostgreSQL 18 临时实例重放迁移后生成，不连接开发数据库。迁移指纹：`2f82f3646dfbe5ec704617b24b019b340ce8751384c38d3762069bf55ecb961c`。

| 表          | 列               | 类型                     | 可空 | 默认值                        |
| ----------- | ---------------- | ------------------------ | ---- | ----------------------------- |
| categories  | id               | uuid                     | NO   | —                             |
| categories  | name             | character varying(50)    | NO   | —                             |
| categories  | sortOrder        | integer                  | NO   | —                             |
| categories  | createdAt        | timestamp with time zone | NO   | CURRENT_TIMESTAMP             |
| foods       | id               | uuid                     | NO   | —                             |
| foods       | legacyId         | character varying(24)    | YES  | —                             |
| foods       | name             | character varying(100)   | NO   | —                             |
| foods       | priceCents       | integer                  | NO   | —                             |
| foods       | description      | character varying(1000)  | NO   | —                             |
| foods       | imageUrl         | character varying(255)   | NO   | —                             |
| foods       | recommended      | boolean                  | NO   | —                             |
| foods       | createdAt        | timestamp with time zone | NO   | CURRENT_TIMESTAMP             |
| foods       | categoryId       | uuid                     | NO   | —                             |
| foods       | status           | character varying(16)    | NO   | 'inactive'::character varying |
| foods       | updatedAt        | timestamp with time zone | NO   | CURRENT_TIMESTAMP             |
| order_items | id               | uuid                     | NO   | —                             |
| order_items | orderId          | uuid                     | NO   | —                             |
| order_items | foodId           | uuid                     | NO   | —                             |
| order_items | position         | integer                  | NO   | —                             |
| order_items | name             | character varying(100)   | NO   | —                             |
| order_items | imageUrl         | character varying(255)   | NO   | —                             |
| order_items | priceCents       | integer                  | NO   | —                             |
| order_items | quantity         | integer                  | NO   | —                             |
| order_items | totalAmountCents | bigint                   | NO   | —                             |
| orders      | id               | uuid                     | NO   | —                             |
| orders      | location         | character varying(100)   | NO   | —                             |
| orders      | tableNumber      | character varying(32)    | NO   | —                             |
| orders      | guestCount       | integer                  | NO   | —                             |
| orders      | comment          | character varying(50)    | NO   | —                             |
| orders      | totalAmountCents | bigint                   | NO   | —                             |
| orders      | totalQuantity    | integer                  | NO   | —                             |
| orders      | createdAt        | timestamp with time zone | NO   | CURRENT_TIMESTAMP             |
| orders      | updatedAt        | timestamp with time zone | NO   | CURRENT_TIMESTAMP             |
| orders      | customerId       | character varying(64)    | YES  | —                             |
| orders      | status           | character varying(16)    | NO   | 'pending'::character varying  |
| sessions    | id               | uuid                     | NO   | —                             |
| sessions    | tokenHash        | character(64)            | NO   | —                             |
| sessions    | kind             | character varying(16)    | NO   | —                             |
| sessions    | principalId      | character varying(64)    | NO   | —                             |
| sessions    | expiresAt        | timestamp with time zone | NO   | —                             |
| sessions    | createdAt        | timestamp with time zone | NO   | CURRENT_TIMESTAMP             |

## 约束

- categories / categories_createdAt_not_null：`NOT NULL "createdAt"`
- categories / categories_id_not_null：`NOT NULL id`
- categories / categories_name_key：`UNIQUE (name)`
- categories / categories_name_not_null：`NOT NULL name`
- categories / categories_pkey：`PRIMARY KEY (id)`
- categories / categories_sortOrder_not_null：`NOT NULL "sortOrder"`
- foods / foods_categoryId_not_null：`NOT NULL "categoryId"`
- foods / foods_category_fk：`FOREIGN KEY ("categoryId") REFERENCES categories(id) ON DELETE RESTRICT`
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
- foods / foods_status_check：`CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying])::text[])))`
- foods / foods_status_not_null：`NOT NULL status`
- foods / foods_updatedAt_not_null：`NOT NULL "updatedAt"`
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
- orders / orders_guestCount_check：`CHECK ((("guestCount" >= 1) AND ("guestCount" <= 5)))`
- orders / orders_guestCount_not_null：`NOT NULL "guestCount"`
- orders / orders_id_not_null：`NOT NULL id`
- orders / orders_location_not_null：`NOT NULL location`
- orders / orders_pkey：`PRIMARY KEY (id)`
- orders / orders_status_check：`CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))`
- orders / orders_status_not_null：`NOT NULL status`
- orders / orders_tableNumber_not_null：`NOT NULL "tableNumber"`
- orders / orders_totalAmountCents_check：`CHECK (("totalAmountCents" >= 0))`
- orders / orders_totalAmountCents_not_null：`NOT NULL "totalAmountCents"`
- orders / orders_totalQuantity_check：`CHECK (("totalQuantity" > 0))`
- orders / orders_totalQuantity_not_null：`NOT NULL "totalQuantity"`
- orders / orders_updatedAt_not_null：`NOT NULL "updatedAt"`
- sessions / sessions_createdAt_not_null：`NOT NULL "createdAt"`
- sessions / sessions_expiresAt_not_null：`NOT NULL "expiresAt"`
- sessions / sessions_id_not_null：`NOT NULL id`
- sessions / sessions_kind_check：`CHECK (((kind)::text = ANY ((ARRAY['merchant'::character varying, 'customer'::character varying])::text[])))`
- sessions / sessions_kind_not_null：`NOT NULL kind`
- sessions / sessions_pkey：`PRIMARY KEY (id)`
- sessions / sessions_principalId_not_null：`NOT NULL "principalId"`
- sessions / sessions_tokenHash_key：`UNIQUE ("tokenHash")`
- sessions / sessions_tokenHash_not_null：`NOT NULL "tokenHash"`

## 索引

- categories / categories_name_key：`CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name)`
- categories / categories_pkey：`CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id)`
- foods / foods_category_idx：`CREATE INDEX foods_category_idx ON public.foods USING btree ("categoryId")`
- foods / foods_legacyId_key：`CREATE UNIQUE INDEX "foods_legacyId_key" ON public.foods USING btree ("legacyId")`
- foods / foods_pkey：`CREATE UNIQUE INDEX foods_pkey ON public.foods USING btree (id)`
- order_items / order_items_orderId_foodId_key：`CREATE UNIQUE INDEX "order_items_orderId_foodId_key" ON public.order_items USING btree ("orderId", "foodId")`
- order_items / order_items_order_idx：`CREATE INDEX order_items_order_idx ON public.order_items USING btree ("orderId")`
- order_items / order_items_pkey：`CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id)`
- orders / orders_created_at_idx：`CREATE INDEX orders_created_at_idx ON public.orders USING btree ("createdAt" DESC)`
- orders / orders_customer_created_idx：`CREATE INDEX orders_customer_created_idx ON public.orders USING btree ("customerId", "createdAt" DESC)`
- orders / orders_pkey：`CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)`
- sessions / sessions_expires_idx：`CREATE INDEX sessions_expires_idx ON public.sessions USING btree ("expiresAt")`
- sessions / sessions_pkey：`CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id)`
- sessions / sessions_tokenHash_key：`CREATE UNIQUE INDEX "sessions_tokenHash_key" ON public.sessions USING btree ("tokenHash")`
