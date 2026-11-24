import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { CustomerAuthGuard } from '../auth/index.js';
import type { AuthenticatedRequest } from '../auth/index.js';
import { OrdersService } from './orders.service.js';

@Controller('customer/orders')
@UseGuards(CustomerAuthGuard)
export class CustomerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.orders.customerList(request.auth!.id);
  }

  @Get(':id')
  detail(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.orders.customerDetail(request.auth!.id, id);
  }
}
