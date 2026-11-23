import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MerchantAuthGuard } from '../auth/auth.guard.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { OrderStatusDto } from './dto/order-status.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('admin/orders')
@UseGuards(MerchantAuthGuard)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: OrderQueryDto) {
    return this.orders.adminList(query);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.orders.adminDetail(id);
  }

  @Patch(':id/status')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: OrderStatusDto,
  ) {
    return this.orders.updateStatus(id, dto);
  }
}
