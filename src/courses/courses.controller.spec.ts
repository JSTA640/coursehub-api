import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { PassportModule } from '@nestjs/passport';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { UpdateCourseUseCase } from './application/use-cases/update-course.use-case.js';
import { CoursesQueryDto } from './dto/courses-query.dto.js';

describe('CoursesController', () => {
  let controller: CoursesController;
  let coursesService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    coursesService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [CoursesController],
      providers: [
        { provide: CoursesService, useValue: coursesService },
        { provide: UpdateCourseUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the validated query DTO to the service', () => {
    const query = Object.assign(new CoursesQueryDto(), {
      level: 'beginner',
      page: 2,
      limit: 5,
      sortBy: 'title',
      order: 'DESC',
    });

    controller.findAll(query);

    expect(coursesService.findAll).toHaveBeenCalledWith(query);
  });
});
