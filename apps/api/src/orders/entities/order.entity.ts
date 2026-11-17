import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { integerTransformer } from '../../database/transformers/integer.transformer.js';
import { OrderItemEntity } from './order-item.entity.js';

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
