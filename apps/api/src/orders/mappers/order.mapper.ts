import type { Order } from '@scanorder/contracts';
import type { OrderEntity } from '../entities/order.entity.js';

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
      .sort((left, right) => left.position - right.position)
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
