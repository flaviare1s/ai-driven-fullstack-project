import { Test, TestingModule } from '@nestjs/testing';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';

describe('UserProfileController', () => {
  let controller: UserProfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserProfileController],
      providers: [UserProfileService],
    }).compile();

    controller = module.get(UserProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('deve responder com pong', () => {
    expect(controller.ping()).toBe('pong');
  });
});
