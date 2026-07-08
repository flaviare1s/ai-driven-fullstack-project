import { Controller, Get } from '@nestjs/common';
import { __CLASS__Service } from './__KEBAB__.service';

@Controller('__KEBAB__')
export class __CLASS__Controller {
  constructor(private readonly __CAMEL__Service: __CLASS__Service) {}

  @Get()
  ping(): string {
    return this.__CAMEL__Service.ping();
  }
}
