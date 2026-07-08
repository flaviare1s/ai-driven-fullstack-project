import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  ping(): string {
    return 'pong';
  }
}
