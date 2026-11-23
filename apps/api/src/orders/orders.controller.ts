import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { CustomerAuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(CustomerAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() request: AuthenticatedRequest) {
    return this.orders.create(dto, request.auth!.id);
  }
}
