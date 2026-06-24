import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret } from '../config/jwt-secret';
import { SignalGateway } from './signal.gateway';

@Module({
  // Same secret as REST/Live to authenticate the socket handshake.
  imports: [JwtModule.register({ secret: getJwtSecret() })],
  providers: [SignalGateway],
  exports: [SignalGateway],
})
export class SignalModule {}
