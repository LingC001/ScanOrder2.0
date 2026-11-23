import { IsIn } from 'class-validator';
import type { UpdateOrderStatusInput } from '@scanorder/contracts';

export class OrderStatusDto implements UpdateOrderStatusInput {
  @IsIn(['accepted', 'completed', 'cancelled'])
  status!: 'accepted' | 'completed' | 'cancelled';
}
