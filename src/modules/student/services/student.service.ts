import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateStudentDto } from '../dtos/create-student.dto';
import { UpdateStudentDto } from '../dtos/update-student.dto';

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateStudentDto) {
    const existing = await this.prisma.student.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new ConflictException(`Email "${data.email}" đã tồn tại`);
    }

    return this.prisma.student.create({ data });
  }

  findAll() {
    return this.prisma.student.findMany();
  }

  async findOne(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async update(id: string, data: UpdateStudentDto) {
    await this.findOne(id); // check tồn tại
    return this.prisma.student.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // check tồn tại
    return this.prisma.student.delete({ where: { id } });
  }
}
