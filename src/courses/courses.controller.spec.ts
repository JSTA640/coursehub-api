import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';

describe('CoursesController', () => {
  let controller: CoursesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{
        provide: CoursesService,
        useValue: {
          findAll: jest.fn(),
          findOne: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          remove: jest.fn(),
        },
      }],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
