import { Column, Entity, PrimaryColumn } from 'typeorm';

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
