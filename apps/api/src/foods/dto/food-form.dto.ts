import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { MAX_PRICE_CENTS } from '@scanorder/contracts';
import type { CreateFoodInput } from '@scanorder/contracts';

export class FoodFormDto implements CreateFoodInput {
  @IsUUID('4', { message: '请选择有效分类' })
  categoryId!: string;

  @IsString({ message: '名称必须是文字' })
  @Length(1, 100, { message: '名称长度须为1至100字' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt({ message: '价格必须是整数分' })
  @Min(0, { message: '价格不可为负数' })
  @Max(MAX_PRICE_CENTS, { message: '价格超出允许范围' })
  priceCents!: number;

  @IsString({ message: '描述必须是文字' })
  @Length(1, 1000, { message: '描述长度须为1至1000字' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  description!: string;

  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: '是否推荐必须为 true 或 false' })
  recommended!: boolean;
}
