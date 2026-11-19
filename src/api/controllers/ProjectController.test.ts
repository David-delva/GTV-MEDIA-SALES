import { NextFunction, Request, Response } from 'express';
import { ProjectController } from './ProjectController';

function createHarness(projectStatus: string) {
  const projectRepo = {
    findById: jest.fn().mockResolvedValue({ id: '10000000-0000-4000-8000-000000000001', status: projectStatus }),
    updateStatus: jest.fn().mockResolvedValue(true),
  };
  const controller = new ProjectController(projectRepo as never, {} as never);
  const response = { json: jest.fn() };
  const next = jest.fn();
  return { controller, projectRepo, response, next };
}

describe('ProjectController admin status transitions', () => {
  test('rejects transitions that bypass submission', async () => {
    const { controller, projectRepo, response, next } = createHarness('DRAFT');

    await controller.updateStatus(
      {
        params: { id: '10000000-0000-4000-8000-000000000001' },
        body: { status: 'CLOSED_WON' },
      } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(projectRepo.updateStatus).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(response.json).not.toHaveBeenCalled();
  });

  test('updates a submitted project through an allowed transition', async () => {
    const { controller, projectRepo, response, next } = createHarness('SUBMITTED');

    await controller.updateStatus(
      {
        params: { id: '10000000-0000-4000-8000-000000000001' },
        body: { status: 'NEGOTIATION' },
      } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(projectRepo.updateStatus).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000001',
      'SUBMITTED',
      'NEGOTIATION'
    );
    expect(response.json).toHaveBeenCalledWith({ success: true, data: { id: '10000000-0000-4000-8000-000000000001', status: 'NEGOTIATION' } });
    expect(next).not.toHaveBeenCalled();
  });
});
