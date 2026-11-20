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

describe('ProjectController client validation', () => {
  test('rejects new projects for inactive clients', async () => {
    const projectRepo = { hasActiveClient: jest.fn().mockResolvedValue(false) };
    const rateCardRepo = { findActive: jest.fn() };
    const controller = new ProjectController(projectRepo as never, rateCardRepo as never);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await controller.create(
      {
        body: { title: 'Campagne test', clientId: '90000000-0000-4000-8000-000000000001' },
        user: { id: 'a0000000-0000-4000-8000-000000000001', role: 'COMMERCIAL' },
      } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(projectRepo.hasActiveClient).toHaveBeenCalledWith('90000000-0000-4000-8000-000000000001');
    expect(rateCardRepo.findActive).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(response.json).not.toHaveBeenCalled();
  });
});

describe('ProjectController project editing', () => {
  test('updates only a commercial user’s own draft with validated fields', async () => {
    const projectRepo = {
      findById: jest.fn().mockResolvedValue({
        id: '10000000-0000-4000-8000-000000000001',
        ownerId: 'a0000000-0000-4000-8000-000000000001',
        status: 'DRAFT',
      }),
      hasActiveClient: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(true),
    };
    const controller = new ProjectController(projectRepo as never, {} as never);
    const response = { json: jest.fn() };
    const next = jest.fn();

    await controller.update(
      {
        params: { id: '10000000-0000-4000-8000-000000000001' },
        body: {
          title: 'Campagne mise à jour',
          clientId: '90000000-0000-4000-8000-000000000001',
          campaignStart: '2027-01-01',
          campaignEnd: null,
          budgetTarget: 2500000,
        },
        user: { id: 'a0000000-0000-4000-8000-000000000001', role: 'COMMERCIAL' },
      } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(projectRepo.update).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000001',
      {
        title: 'Campagne mise à jour',
        clientId: '90000000-0000-4000-8000-000000000001',
        campaignStart: '2027-01-01',
        campaignEnd: null,
        budgetTarget: 2500000,
      }
    );
    expect(response.json).toHaveBeenCalledWith({ success: true, data: { id: '10000000-0000-4000-8000-000000000001' } });
    expect(next).not.toHaveBeenCalled();
  });

  test('does not allow commercial users to edit another owner’s project', async () => {
    const projectRepo = {
      findById: jest.fn().mockResolvedValue({
        id: '10000000-0000-4000-8000-000000000001',
        ownerId: 'b0000000-0000-4000-8000-000000000001',
        status: 'DRAFT',
      }),
      update: jest.fn(),
    };
    const controller = new ProjectController(projectRepo as never, {} as never);
    const next = jest.fn();

    await controller.update(
      {
        params: { id: '10000000-0000-4000-8000-000000000001' },
        body: {
          title: 'Campagne mise à jour',
          clientId: '90000000-0000-4000-8000-000000000001',
          campaignStart: null,
          campaignEnd: null,
          budgetTarget: null,
        },
        user: { id: 'a0000000-0000-4000-8000-000000000001', role: 'COMMERCIAL' },
      } as unknown as Request,
      {} as Response,
      next as NextFunction
    );

    expect(projectRepo.update).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

describe('ProjectController follow-up validation', () => {
  test('creates an owned reminder with a valid date', async () => {
    const projectRepo = {
      findById: jest.fn().mockResolvedValue({
        id: '10000000-0000-4000-8000-000000000001',
        ownerId: 'a0000000-0000-4000-8000-000000000001',
      }),
      createFollowUp: jest.fn().mockResolvedValue({
        id: 'c0000000-0000-4000-8000-000000000001',
        projectId: '10000000-0000-4000-8000-000000000001',
        note: 'Relancer le client',
        dueDate: '2027-01-15',
        completedAt: null,
        createdAt: '2027-01-01T10:00:00.000Z',
      }),
    };
    const controller = new ProjectController(projectRepo as never, {} as never);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await controller.createFollowUp(
      {
        params: { id: '10000000-0000-4000-8000-000000000001' },
        body: { note: '  Relancer le client  ', dueDate: '2027-01-15' },
        user: { id: 'a0000000-0000-4000-8000-000000000001', role: 'COMMERCIAL' },
      } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(projectRepo.createFollowUp).toHaveBeenCalledWith({
      projectId: '10000000-0000-4000-8000-000000000001',
      authorId: 'a0000000-0000-4000-8000-000000000001',
      note: 'Relancer le client',
      dueDate: '2027-01-15',
    });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects invalid reminder dates', async () => {
    const projectRepo = { findById: jest.fn(), createFollowUp: jest.fn() };
    const controller = new ProjectController(projectRepo as never, {} as never);
    const next = jest.fn();

    await controller.createFollowUp(
      {
        params: { id: '10000000-0000-4000-8000-000000000001' },
        body: { note: 'Relancer le client', dueDate: '2027-02-31' },
        user: { id: 'a0000000-0000-4000-8000-000000000001', role: 'COMMERCIAL' },
      } as unknown as Request,
      {} as Response,
      next as NextFunction
    );

    expect(projectRepo.createFollowUp).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});
