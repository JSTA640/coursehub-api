import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';

describe('EnrollmentsController', () => {
  let controller: EnrollmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentsController],
      providers: [{
        provide: EnrollmentsService,
        useValue: {
          create: jest.fn(),
          findAll: jest.fn(),
          findByCourse: jest.fn(),
          findByStudent: jest.fn(),
          remove: jest.fn(),
        },
      }],
    }).compile();

    controller = module.get<EnrollmentsController>(EnrollmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
