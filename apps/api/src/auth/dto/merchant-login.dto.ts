import { IsString, Length } from 'class-validator';

export class MerchantLoginDto {
  @IsString()
  @Length(1, 100)
  username!: string;

  @IsString()
  @Length(1, 200)
  password!: string;
}
