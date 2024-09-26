import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UserController } from './user.constroller';
import { UserService } from './user.service';
import { EncryptionHelper } from './encryption.helper';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from 'aws-sdk';

@Module({
    imports: [ConfigModule, MongooseModule.forFeature([{name: User.name, schema: UserSchema}])],
    controllers: [UserController],
    providers: [UserService, EncryptionHelper]

})
export class UsersModule {}
