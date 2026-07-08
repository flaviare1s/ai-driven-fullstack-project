import { Test, TestingModule } from '@nestjs/testing';
import { UserProfileService } from './user-profile.service';

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserProfileService],
    }).compile();

    service = module.get(UserProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('deve responder com pong', () => {
    expect(service.ping()).toBe('pong');
  });
});
