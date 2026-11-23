import { IsIn } from 'class-validator';

export class FoodStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}
