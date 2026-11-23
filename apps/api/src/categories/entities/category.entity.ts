import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { FoodEntity } from '../../foods/entities/food.entity.js';

@Entity('categories')
export class CategoryEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 50, unique: true }) name!: string;
  @Column({ type: 'integer' }) sortOrder!: number;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

  @OneToMany(() => FoodEntity, (food) => food.category)
  foods!: Relation<FoodEntity[]>;
}
