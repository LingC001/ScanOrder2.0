import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.service.js';

@Injectable()
export class MerchantAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const principal = await this.auth.resolve(request, 'merchant');
    if (!principal) throw new UnauthorizedException('请先登录商家后台');
    (request as AuthenticatedRequest).auth = principal;
    return true;
  }
}

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const principal = await this.auth.resolve(request, 'customer');
    if (!principal) throw new UnauthorizedException('请先登录顾客账号');
    (request as AuthenticatedRequest).auth = principal;
    return true;
  }
}
