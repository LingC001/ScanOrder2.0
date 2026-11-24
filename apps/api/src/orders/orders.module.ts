import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/index.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { CustomerOrdersController } from './customer-orders.controller.js';
import { OrderEntity } from './entities/order.entity.js';
import { OrderItemEntity } from './entities/order-item.entity.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, OrderItemEntity]), AuthModule],
  controllers: [OrdersController, CustomerOrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
