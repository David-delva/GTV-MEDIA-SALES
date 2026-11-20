import { NextFunction, Request, Response } from 'express';
import { AdminClientController } from './AdminClientController';

function createHarness(repositoryOverrides: Record<string, unknown> = {}) {
  const repository = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    ...repositoryOverrides,
  };
  const controller = new AdminClientController(repository as never);
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  return { controller, repository, response, next };
}

describe('AdminClientController', () => {
  test('trims client data and creates a client', async () => {
    const client = {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Gabon Telecom',
      sector: 'Télécommunications',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const { controller, repository, response, next } = createHarness({
      create: jest.fn().mockResolvedValue(client),
    });

    await controller.create(
      { body: { name: ' Gabon Telecom ', sector: ' Télécommunications ' } } as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(repository.create).toHaveBeenCalledWith({ name: 'Gabon Telecom', sector: 'Télécommunications' });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ success: true, data: client });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects invalid client identifiers before changing active state', async () => {
    const { controller, repository, response, next } = createHarness();

    await controller.setActive(
      { params: { id: 'invalid' }, body: { isActive: false } } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(repository.setActive).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(response.json).not.toHaveBeenCalled();
  });
});
