import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { FoodStatus } from '@scanorder/contracts';
import { CategoryEntity } from '../../categories/entities/category.entity.js';

@Entity('foods')
export class FoodEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 24, nullable: true, unique: true }) legacyId!: string | null;
  @Column('uuid') categoryId!: string;
  @Column({ type: 'varchar', length: 100 }) name!: string;
  @Column({ type: 'integer' }) priceCents!: number;
  @Column({ type: 'varchar', length: 1000 }) description!: string;
  @Column({ type: 'varchar', length: 255 }) imageUrl!: string;
  @Column({ type: 'boolean' }) recommended!: boolean;
  @Column({ type: 'varchar', length: 16 }) status!: FoodStatus;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) updatedAt!: Date;

  @ManyToOne(() => CategoryEntity, (category) => category.foods, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category!: Relation<CategoryEntity>;
}
