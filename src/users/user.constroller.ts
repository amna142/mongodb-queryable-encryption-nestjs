import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { UserService } from "./user.service";


@Controller('user')
export class UserController {
    constructor(private userService: UserService){}

    @Post()
    async create(@Body() dto: any) {
    return await this.userService.create(dto);
    }

    @Get(':id')
    async findOne(@Param('id') id: string){
        return await this.userService.find(id)
    }
}