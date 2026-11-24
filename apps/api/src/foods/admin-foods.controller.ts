import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MerchantAuthGuard } from '../auth/index.js';
import { MAX_IMAGE_SIZE } from '../storage/image.js';
import { FoodFormDto } from './dto/food-form.dto.js';
import { FoodQueryDto } from './dto/food-query.dto.js';
import { FoodStatusDto } from './dto/food-status.dto.js';
import { FoodsService } from './foods.service.js';

@Controller('admin/foods')
@UseGuards(MerchantAuthGuard)
export class AdminFoodsController {
  constructor(private readonly foods: FoodsService) {}

  @Get()
  list(@Query() query: FoodQueryDto) {
    return this.foods.adminList(query);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.foods.detail(id);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 5 } }),
  )
  create(@Body() dto: FoodFormDto, @UploadedFile() file?: Express.Multer.File) {
    return this.foods.create(dto, file?.buffer);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: FoodStatusDto,
  ) {
    return this.foods.setStatus(id, dto.status);
  }

  @Post(':id/restore')
  restore(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.foods.restore(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 5 } }),
  )
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: FoodFormDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.foods.update(id, dto, file?.buffer);
  }

  @Delete(':id')
  archive(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.foods.archive(id);
  }
}
