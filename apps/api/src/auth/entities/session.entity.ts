import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type SessionKind = 'merchant' | 'customer';

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash!: string;
  @Column({ type: 'varchar', length: 16 })
  kind!: SessionKind;
  @Column({ type: 'varchar', length: 64 })
  principalId!: string;
  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
