import { Test, TestingModule } from '@nestjs/testing';
import { __CLASS__Controller } from './__KEBAB__.controller';
import { __CLASS__Service } from './__KEBAB__.service';

describe('__CLASS__Controller', () => {
  let controller: __CLASS__Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [__CLASS__Controller],
      providers: [__CLASS__Service],
    }).compile();

    controller = module.get(__CLASS__Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('deve responder com pong', () => {
    expect(controller.ping()).toBe('pong');
  });
});
