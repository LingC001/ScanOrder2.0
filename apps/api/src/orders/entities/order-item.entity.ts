import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { FoodEntity } from '../../foods/entities/food.entity.js';
import { integerTransformer } from '../../database/transformers/integer.transformer.js';
import { OrderEntity } from './order.entity.js';

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
