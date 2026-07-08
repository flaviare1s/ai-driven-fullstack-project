import { Module } from '@nestjs/common';
import { __CLASS__Controller } from './__KEBAB__.controller';
import { __CLASS__Service } from './__KEBAB__.service';

@Module({
  controllers: [__CLASS__Controller],
  providers: [__CLASS__Service],
  exports: [__CLASS__Service],
})
export class __CLASS__Module {}
