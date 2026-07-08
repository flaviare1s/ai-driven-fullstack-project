import { Test, TestingModule } from '@nestjs/testing';
import { __CLASS__Service } from './__KEBAB__.service';

describe('__CLASS__Service', () => {
  let service: __CLASS__Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [__CLASS__Service],
    }).compile();

    service = module.get(__CLASS__Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('deve responder com pong', () => {
    expect(service.ping()).toBe('pong');
  });
});
