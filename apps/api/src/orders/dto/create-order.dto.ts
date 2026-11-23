import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_QUANTITY } from '@scanorder/contracts';
import type { CreateOrderInput } from '@scanorder/contracts';

class OrderLineDto {
  @IsUUID('4', { message: '菜品编号无效' }) foodId!: string;
  @IsInt({ message: '数量必须是整数' })
  @Min(1, { message: '数量至少为1' })
  @Max(MAX_QUANTITY, { message: '单品数量最多为999' })
  quantity!: number;
}

export class CreateOrderDto implements CreateOrderInput {
  @IsString({ message: '桌号必须是文字' })
  @Length(1, 32, { message: '桌号长度须为1至32字' })
  tableNumber!: string;
  @IsInt({ message: '用餐人数必须是整数' })
  @Min(1, { message: '用餐人数至少为1人' })
  @Max(5, { message: '用餐人数最多为5人' })
  guestCount!: number;
  @IsString({ message: '备注必须是文字' })
  @Length(0, 50, { message: '备注最多为50字' })
  comment!: string;
  @IsArray({ message: '菜品必须是列表' })
  @ArrayMinSize(1, { message: '请先选择菜品' })
  @ArrayMaxSize(100, { message: '一次最多选择100种菜品' })
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];
}
