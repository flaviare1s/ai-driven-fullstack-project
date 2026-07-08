import { Controller, Get } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';

@Controller('user-profile')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get()
  ping(): string {
    return this.userProfileService.ping();
  }
}
