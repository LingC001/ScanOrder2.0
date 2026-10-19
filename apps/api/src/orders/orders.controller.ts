import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CreateOrderDto } from './order.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Post() create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }
  @Get() list() {
    return this.orders.list();
  }
  @Get(':id') detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.orders.detail(id);
  }
}
