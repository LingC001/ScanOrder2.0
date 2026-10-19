import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { SHOP } from '@scanorder/contracts';
import type { Order } from '@scanorder/contracts';
import { DATABASE } from '../database/data-source.js';
import { FoodEntity, OrderEntity, OrderItemEntity } from '../database/entities.js';
import type { CreateOrderDto } from './order.dto.js';

export function toOrder(order: OrderEntity): Order {
  return {
    id: order.id,
    location: order.location,
    tableNumber: order.tableNumber,
    guestCount: order.guestCount,
    comment: order.comment,
    totalAmountCents: order.totalAmountCents,
    totalQuantity: order.totalQuantity,
    finished: order.finished,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: [...order.items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        foodId: item.foodId,
        name: item.name,
        imageUrl: item.imageUrl,
        priceCents: item.priceCents,
        quantity: item.quantity,
        totalAmountCents: item.totalAmountCents,
      })),
  };
}

@Injectable()
export class OrdersService {
  constructor(@Inject(DATABASE) private readonly source: DataSource) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const ids = dto.items.map((item) => item.foodId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('同一种菜品请合并数量');
    return this.source.transaction(async (manager) => {
      const foods = await manager.find(FoodEntity, { where: { id: In(ids) } });
      const foodMap = new Map(foods.map((food) => [food.id, food]));
      if (foods.length !== ids.length)
        throw new BadRequestException('部分菜品不存在，请返回菜单重新选择');
      const id = randomUUID();
      const items = dto.items.map((line, position) => {
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
        tableNumber: dto.tableNumber.trim(),
        guestCount: dto.guestCount,
        comment: dto.comment,
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
    const orders = await this.source
      .getRepository(OrderEntity)
      .find({ relations: { items: true }, order: { createdAt: 'DESC', id: 'DESC' } });
    return orders.map(toOrder);
  }

  async detail(id: string): Promise<Order> {
    const order = await this.source
      .getRepository(OrderEntity)
      .findOne({ where: { id }, relations: { items: true } });
    if (!order) throw new NotFoundException('订单不存在');
    return toOrder(order);
  }
}
