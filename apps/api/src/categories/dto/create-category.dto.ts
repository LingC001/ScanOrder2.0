import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class CreateCategoryDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '分类名称必须是文字' })
  @Length(1, 50, { message: '分类名称须为1至50字' })
  name!: string;
}
