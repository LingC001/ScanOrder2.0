import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { MerchantLoginDto } from './dto/merchant-login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('merchant')
  merchantStatus(@Req() request: Request) {
    return this.auth.merchantStatus(request);
  }

  @Post('merchant/login')
  loginMerchant(
    @Body() dto: MerchantLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.loginMerchant(dto.username, dto.password, request, response);
  }

  @Post('merchant/logout')
  async logoutMerchant(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout('merchant', request, response);
    return { ok: true };
  }

  @Get('customer')
  customerStatus(@Req() request: Request) {
    return this.auth.customerStatus(request);
  }

  @Post('customer/login')
  loginCustomer(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.loginCustomer(request, response);
  }

  @Post('customer/logout')
  async logoutCustomer(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout('customer', request, response);
    return { ok: true };
  }
}
