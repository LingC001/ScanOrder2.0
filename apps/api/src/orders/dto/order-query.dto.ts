import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { OrderStatus } from '@scanorder/contracts';

function integer(value: unknown): unknown {
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
}

export class OrderQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => integer(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  search = '';

  @IsOptional()
  @IsIn(['pending', 'accepted', 'completed', 'cancelled'])
  status?: OrderStatus;
}
