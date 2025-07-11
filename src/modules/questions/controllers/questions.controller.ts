import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Patch,
    Body,
    Param,
    Req,
    UseGuards,
    BadRequestException,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiBody,
    ApiParam,
    ApiConsumes,
} from '@nestjs/swagger';
import { QuestionsService } from '../services/questions.service';
import { CreateQuestionDto } from '../dtos/create-question.dto';
import { UpdateQuestionDto } from '../dtos/update-question.dto';
import { UpdateQuestionPatchDto } from '../dtos/update-question-patch.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Questions')
@Controller('questions')
export class QuestionsController {
    constructor(private readonly questionsService: QuestionsService) { }

    @Post()
    @Roles(Role.Customer)
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({
        summary: 'Customer tạo câu hỏi mới và gửi đến tư vấn viên',
        description: `
Tạo một câu hỏi và gửi đến Tư vấn viên được chọn. Khách hàng phải chọn Tư vấn viên từ danh sách dựa trên chuyên môn. Hình ảnh có thể được đính kèm để hỗ trợ tư vấn.
- Hệ thống kiểm tra quyền và Tư vấn viên hợp lệ.
- Gửi email thông báo cho Tư vấn viên.
- Giới hạn kích thước hình ảnh tối đa 5MB.
- Tất cả câu hỏi được tạo mặc định là ẩn danh.
`,
    })
    @ApiBearerAuth('access-token')
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        type: CreateQuestionDto,
        description: `
Body (dùng form-data):
- consultant_id: ID của Consultant (bắt buộc)
- title: Tiêu đề câu hỏi (bắt buộc)
- content: Nội dung câu hỏi (bắt buộc)
- image: Hình ảnh đính kèm (tùy chọn, định dạng JPEG/PNG, tối đa 5MB)
- category: Danh mục câu hỏi (tùy chọn, e.g., STI, Fertility, General)
`,
    })
    @UseInterceptors(FileInterceptor('image', {
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, callback) => {
            if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
                return callback(new BadRequestException('Chỉ chấp nhận file JPEG hoặc PNG'), false);
            }
            callback(null, true);
        },
    }))
    async createQuestion(
        @Req() req,
        @Body('title') title: string,
        @Body('content') content: string,
        @Body('consultant_id') consultant_id: string,
        @Body('category') category: string,
        @UploadedFile() image?: Express.Multer.File,
    ) {
        const userId = (req.user as any).userId;
        if (!title || !content || !consultant_id) {
            throw new BadRequestException('Title, content, and consultant_id are required');
        }

        const dto: CreateQuestionDto = {
            title,
            content,
            consultant_id,
            category,
            image,
        };
        return this.questionsService.createQuestion(userId, dto);
    }

    @Put(':id/answer')
    @Roles(Role.Consultant)
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({
        summary: 'Trả lời câu hỏi',
        description: `
Consultant trả lời câu hỏi được gán. Cập nhật trạng thái thành 'Answered' và gửi email thông báo cho khách hàng.
- Chỉ Consultant được gán mới có quyền trả lời.
`,
    })
    @ApiBearerAuth('access-token')
    @ApiParam({ name: 'id', description: 'ID câu hỏi', type: String })
    @ApiBody({ type: UpdateQuestionDto })
    async answerQuestion(@Param('id') id: string, @Req() req, @Body() dto: UpdateQuestionDto) {
        const userId = (req.user as any).userId;
        return this.questionsService.answerQuestion(id, userId, dto.answer);
    }

    @Delete(':id')
    @Roles(Role.Consultant)
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({
        summary: 'Xóa câu hỏi',
        description: `
Consultant xóa câu hỏi nếu hình ảnh hoặc nội dung không phù hợp. Cập nhật trạng thái thành 'Deleted', xóa hình ảnh trên Cloudinary, và gửi email thông báo cho khách hàng.
- Chỉ Consultant được gán mới có quyền xóa.
- Reason (lý do) là tùy chọn.
`,
    })
    @ApiBearerAuth('access-token')
    @ApiParam({ name: 'id', description: 'ID câu hỏi', type: String })
    async deleteQuestion(@Param('id') id: string, @Req() req, @Body('reason') reason?: string) {
        const userId = (req.user as any).userId;
        return this.questionsService.deleteQuestion(id, userId, reason);
    }
    
    @Patch(':id')
    @Roles(Role.Customer)
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({
        summary: 'Cập nhật câu hỏi',
        description: `
Khách hàng cập nhật tiêu đề hoặc nội dung câu hỏi khi trạng thái là 'Pending'. Chỉ cho phép chỉnh sửa trước khi Consultant trả lời.
`,
    })
    @ApiBearerAuth('access-token')
    @ApiParam({ name: 'id', description: 'ID câu hỏi', type: String })
    @ApiBody({ type: UpdateQuestionPatchDto })
    async updateQuestion(@Param('id') id: string, @Req() req, @Body() dto: UpdateQuestionPatchDto) {
        const userId = (req.user as any).userId;
        return this.questionsService.updateQuestion(id, userId, dto);
    }

    // GET endpoints - sắp xếp từ cụ thể đến tổng quát
    @Get('my')
    @Roles(Role.Customer)
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({
        summary: 'Xem danh sách câu hỏi của tôi',
        description: `
Trả về danh sách tất cả câu hỏi của khách hàng hiện tại, bao gồm trạng thái và trả lời (nếu có).
`,
    })
    @ApiBearerAuth('access-token')
    async getMyQuestions(@Req() req) {
        const userId = (req.user as any).userId;
        return this.questionsService.getMyQuestions(userId);
    }

    @Get('assigned')
    @Roles(Role.Consultant)
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({
        summary: 'Xem danh sách câu hỏi được gán',
        description: `
Trả về danh sách tất cả câu hỏi được gán cho Consultant hiện tại, bao gồm trạng thái và thông tin người dùng.
- Chỉ Consultant được gán mới có quyền xem.
`,
    })
    @ApiBearerAuth('access-token')
    async getAssignedQuestions(@Req() req) {
        const userId = (req.user as any).userId;
        return this.questionsService.getAssignedQuestions(userId);
    }

    @Get(':id')
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({
        summary: 'Xem chi tiết câu hỏi',
        description: `
Trả về thông tin chi tiết của một câu hỏi. 
- Customer: Chỉ xem câu hỏi của mình.
- Consultant: Chỉ xem câu hỏi được gán.
- Staff/Manager: Xem tất cả.
`,
    })
    @ApiBearerAuth('access-token')
    @ApiParam({ name: 'id', description: 'ID câu hỏi', type: String })
    async getQuestionById(@Param('id') id: string, @Req() req) {
        const userId = (req.user as any).userId;
        const role = (req.user as any).role;
        return this.questionsService.getQuestionById(id, userId, role);
    }

    @Get()
    @Roles(Role.Staff, Role.Manager)
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({
        summary: 'Xem tất cả câu hỏi',
        description: `
Trả về danh sách tất cả câu hỏi (chưa xóa) để Staff/Manager giám sát. Bao gồm thông tin người dùng, Consultant, và trạng thái.
`,
    })
    @ApiBearerAuth('access-token')
    async getAllQuestions() {
        return this.questionsService.getAllQuestions();
    }
}