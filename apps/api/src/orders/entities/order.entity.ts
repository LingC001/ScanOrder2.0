import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { OrderStatus } from '@scanorder/contracts';
import { integerTransformer } from '../../database/transformers/integer.transformer.js';
import type { OrderItemEntity } from './order-item.entity.js';

@Entity('orders')
export class OrderEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) customerId!: string | null;
  @Column({ type: 'varchar', length: 100 }) location!: string;
  @Column({ type: 'varchar', length: 32 }) tableNumber!: string;
  @Column({ type: 'integer' }) guestCount!: number;
  @Column({ type: 'varchar', length: 50 }) comment!: string;
  @Column({ type: 'bigint', transformer: integerTransformer }) totalAmountCents!: number;
  @Column({ type: 'integer' }) totalQuantity!: number;
  @Column({ type: 'varchar', length: 16 }) status!: OrderStatus;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) updatedAt!: Date;

  @OneToMany('OrderItemEntity', (item: OrderItemEntity) => item.order, { cascade: ['insert'] })
  items!: Relation<OrderItemEntity[]>;
}
