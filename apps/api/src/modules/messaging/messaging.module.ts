import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Message } from './entities/message.entity';
import { User } from '../users/entities/user.entity';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, ConversationMember, Message, User])],
  providers: [MessagingService, ChatGateway],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
