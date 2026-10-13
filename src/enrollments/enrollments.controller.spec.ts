import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollmentsQueryDto } from './dto/enrollments-query.dto.js';

describe('EnrollmentsController', () => {
  let controller: EnrollmentsController;
  let enrollmentsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findByCourse: jest.Mock;
    findByStudent: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    enrollmentsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByCourse: jest.fn(),
      findByStudent: jest.fn(),
      remove: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentsController],
      providers: [{ provide: EnrollmentsService, useValue: enrollmentsService }],
    }).compile();

    controller = module.get<EnrollmentsController>(EnrollmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes enrollment list filters to the service', () => {
    const query = Object.assign(new EnrollmentsQueryDto(), {
      search: 'nestjs',
      activeOnly: 'true',
      page: 2,
      limit: 5,
    });

    controller.findAll(query);

    expect(enrollmentsService.findAll).toHaveBeenCalledWith(query);
  });
});
