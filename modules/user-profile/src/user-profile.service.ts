import { Injectable } from '@nestjs/common';

@Injectable()
export class UserProfileService {
  ping(): string {
    return 'pong';
  }
}
