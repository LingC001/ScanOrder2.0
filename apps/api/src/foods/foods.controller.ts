import { Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateFoodDto } from './food.dto.js';
import { MAX_IMAGE_SIZE } from './image.js';
import { FoodsService } from './foods.service.js';

@Controller('foods')
export class FoodsController {
  constructor(private readonly foods: FoodsService) {}

  @Get() list() {
    return this.foods.list();
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 5 } }),
  )
  create(@Body() dto: CreateFoodDto, @UploadedFile() file?: Express.Multer.File) {
    return this.foods.create(dto, file);
  }
}
