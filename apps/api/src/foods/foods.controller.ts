import { Controller, Get, UseGuards } from '@nestjs/common';
import { CustomerAuthGuard } from '../auth/auth.guard.js';
import { FoodsService } from './foods.service.js';

@Controller('foods')
@UseGuards(CustomerAuthGuard)
export class FoodsController {
  constructor(private readonly foods: FoodsService) {}

  @Get()
  list() {
    return this.foods.list();
  }
}
