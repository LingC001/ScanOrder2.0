import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { SHOP } from '@scanorder/contracts';
import type { CreateOrderInput, Order } from '@scanorder/contracts';
import { DataSource, In } from 'typeorm';
import type { Repository } from 'typeorm';
import { FoodEntity } from '../foods/entities/food.entity.js';
import { OrderEntity } from './entities/order.entity.js';
import { OrderItemEntity } from './entities/order-item.entity.js';
import { toOrder } from './mappers/order.mapper.js';
import { withSpan } from '../telemetry/spans.js';

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
  ) {}

  async create(input: CreateOrderInput): Promise<Order> {
    return withSpan('orders.create', () => this.createTransaction(input));
  }

  private async createTransaction(input: CreateOrderInput): Promise<Order> {
    const ids = input.items.map((item) => item.foodId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('同一种菜品请合并数量');
    return this.source.transaction(async (manager) => {
      const foods = await manager.find(FoodEntity, { where: { id: In(ids) } });
      const foodMap = new Map(foods.map((food) => [food.id, food]));
      if (foods.length !== ids.length)
        throw new BadRequestException('部分菜品不存在，请返回菜单重新选择');
      const id = randomUUID();
      const items = input.items.map((line, position) => {
        const food = foodMap.get(line.foodId)!;
        return manager.create(OrderItemEntity, {
          id: randomUUID(),
          orderId: id,
          foodId: food.id,
          position,
          name: food.name,
          imageUrl: food.imageUrl,
          priceCents: food.priceCents,
          quantity: line.quantity,
          totalAmountCents: food.priceCents * line.quantity,
        });
      });
      const totalAmountCents = items.reduce((sum, item) => sum + item.totalAmountCents, 0);
      if (!Number.isSafeInteger(totalAmountCents))
        throw new BadRequestException('订单金额超出允许范围');
      const order = manager.create(OrderEntity, {
        id,
        location: SHOP.name,
        tableNumber: input.tableNumber.trim(),
        guestCount: input.guestCount,
        comment: input.comment,
        finished: true,
        items,
        totalAmountCents,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      if (!order.tableNumber) throw new BadRequestException('请填写桌号');
      return toOrder(await manager.save(order));
    });
  }

  async list(): Promise<Order[]> {
    const orders = await this.orders.find({
      relations: { items: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return orders.map(toOrder);
  }

  async detail(id: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id }, relations: { items: true } });
    if (!order) throw new NotFoundException('订单不存在');
    return toOrder(order);
  }
}
