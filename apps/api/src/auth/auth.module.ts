import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CustomerAuthGuard, MerchantAuthGuard } from './auth.guard.js';
import { SessionEntity } from './entities/session.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([SessionEntity])],
  controllers: [AuthController],
  providers: [AuthService, MerchantAuthGuard, CustomerAuthGuard],
  exports: [AuthService, MerchantAuthGuard, CustomerAuthGuard, TypeOrmModule],
})
export class AuthModule {}
