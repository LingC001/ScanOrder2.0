import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation, ValueTransformer } from 'typeorm';

const integerTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string | number) => Number(value),
};

@Entity('foods')
export class FoodEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 24, nullable: true, unique: true }) legacyId!: string | null;
  @Column({ type: 'varchar', length: 50 }) category!: string;
  @Column({ type: 'varchar', length: 100 }) name!: string;
  @Column({ type: 'integer' }) priceCents!: number;
  @Column({ type: 'varchar', length: 1000 }) description!: string;
  @Column({ type: 'varchar', length: 255 }) imageUrl!: string;
  @Column({ type: 'boolean' }) recommended!: boolean;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
}

@Entity('orders')
export class OrderEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 100 }) location!: string;
  @Column({ type: 'varchar', length: 32 }) tableNumber!: string;
  @Column({ type: 'integer' }) guestCount!: number;
  @Column({ type: 'varchar', length: 50 }) comment!: string;
  @Column({ type: 'bigint', transformer: integerTransformer }) totalAmountCents!: number;
  @Column({ type: 'integer' }) totalQuantity!: number;
  @Column({ type: 'boolean', default: true }) finished!: boolean;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) updatedAt!: Date;
  @OneToMany(() => OrderItemEntity, (item) => item.order, { cascade: ['insert'] })
  items!: Relation<OrderItemEntity[]>;
}

@Entity('order_items')
export class OrderItemEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') orderId!: string;
  @Column('uuid') foodId!: string;
  @Column({ type: 'integer' }) position!: number;
  @Column({ type: 'varchar', length: 100 }) name!: string;
  @Column({ type: 'varchar', length: 255 }) imageUrl!: string;
  @Column({ type: 'integer' }) priceCents!: number;
  @Column({ type: 'integer' }) quantity!: number;
  @Column({ type: 'bigint', transformer: integerTransformer }) totalAmountCents!: number;
  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Relation<OrderEntity>;
  @ManyToOne(() => FoodEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'foodId' })
  food!: Relation<FoodEntity>;
}
