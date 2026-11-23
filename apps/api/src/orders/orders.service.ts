import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { SHOP } from '@scanorder/contracts';
import type {
  CreateOrderInput,
  Order,
  OrderStatus,
  Page,
  UpdateOrderStatusInput,
} from '@scanorder/contracts';
import { DataSource, In } from 'typeorm';
import type { Repository } from 'typeorm';
import { FoodEntity } from '../foods/entities/food.entity.js';
import type { OrderQueryDto } from './dto/order-query.dto.js';
import { OrderEntity } from './entities/order.entity.js';
import { OrderItemEntity } from './entities/order-item.entity.js';
import { toOrder } from './mappers/order.mapper.js';
import { withSpan } from '../telemetry/spans.js';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'completed', 'cancelled'],
  accepted: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
  ) {}

  async create(input: CreateOrderInput, customerId: string): Promise<Order> {
    return withSpan('orders.create', () => this.createTransaction(input, customerId));
  }

  private async createTransaction(input: CreateOrderInput, customerId: string): Promise<Order> {
    const ids = input.items.map((item) => item.foodId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('同一种菜品请合并数量');
    return this.source.transaction(async (manager) => {
      const foods = await manager.find(FoodEntity, {
        where: { id: In(ids), status: 'active' },
      });
      const foodMap = new Map(foods.map((food) => [food.id, food]));
      if (foods.length !== ids.length)
        throw new BadRequestException('部分菜品已下架或不存在，请返回菜单重新选择');
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
        customerId,
        location: SHOP.name,
        tableNumber: input.tableNumber.trim(),
        guestCount: input.guestCount,
        comment: input.comment,
        status: 'pending',
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

  async customerList(customerId: string): Promise<Order[]> {
    const orders = await this.orders.find({
      where: { customerId },
      relations: { items: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return orders.map(toOrder);
  }

  async customerDetail(customerId: string, id: string): Promise<Order> {
    return this.detail(id, customerId);
  }

  async adminList(query: OrderQueryDto): Promise<Page<Order>> {
    const builder = this.orders
      .createQueryBuilder('orderEntity')
      .leftJoinAndSelect('orderEntity.items', 'item');
    if (query.search)
      builder.andWhere(
        '(CAST(orderEntity.id AS text) ILIKE :search OR orderEntity.tableNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    if (query.status) builder.andWhere('orderEntity.status = :status', { status: query.status });
    const [items, total] = await builder
      .orderBy('orderEntity.createdAt', 'DESC')
      .addOrderBy('orderEntity.id', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return {
      items: items.map(toOrder),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async adminDetail(id: string): Promise<Order> {
    return this.detail(id);
  }

  async updateStatus(id: string, input: UpdateOrderStatusInput): Promise<Order> {
    await this.source.transaction(async (manager) => {
      const order = await manager
        .getRepository(OrderEntity)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :id', { id })
        .getOne();
      if (!order) throw new NotFoundException('订单不存在');
      if (!TRANSITIONS[order.status].includes(input.status))
        throw new ConflictException('订单当前状态不允许此操作');
      order.status = input.status;
      order.updatedAt = new Date();
      await manager.save(order);
    });
    return this.detail(id);
  }

  private async detail(id: string, customerId?: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: customerId ? { id, customerId } : { id },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return toOrder(order);
  }
}
