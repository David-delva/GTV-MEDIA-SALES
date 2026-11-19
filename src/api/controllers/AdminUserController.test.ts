import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { AdminUserController } from './AdminUserController';

function createHarness(repositoryOverrides: Record<string, unknown> = {}) {
  const repository = {
    findAll: jest.fn(),
    create: jest.fn(),
    setActive: jest.fn(),
    ...repositoryOverrides,
  };
  const controller = new AdminUserController(repository as never);
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  return { controller, repository, response, next };
}

describe('AdminUserController', () => {
  test('does not allow an administrator to disable their own account', async () => {
    const { controller, repository, response, next } = createHarness();
    const id = '10000000-0000-4000-8000-000000000001';

    await controller.setActive(
      { params: { id }, body: { isActive: false }, user: { id, role: 'ADMIN' } } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(repository.setActive).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(response.json).not.toHaveBeenCalled();
  });

  test('reports when the last active administrator cannot be disabled', async () => {
    const { controller, repository, response, next } = createHarness({
      setActive: jest.fn().mockResolvedValue('LAST_ADMIN'),
    });
    const id = '20000000-0000-4000-8000-000000000001';

    await controller.setActive(
      { params: { id }, body: { isActive: false }, user: { id: '30000000-0000-4000-8000-000000000001', role: 'ADMIN' } } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'LAST_ACTIVE_ADMIN', statusCode: 409 }));
    expect(response.json).not.toHaveBeenCalled();
  });

  test('normalizes email and stores only a password hash when creating a user', async () => {
    const createdUser = {
      id: '40000000-0000-4000-8000-000000000001',
      email: 'new.user@example.invalid',
      name: 'New User',
      role: 'COMMERCIAL',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const { controller, repository, response, next } = createHarness({
      create: jest.fn().mockResolvedValue(createdUser),
    });
    const password = 'Long-Demo-Password-2026!';

    await controller.create(
      { body: { email: ' New.User@Example.Invalid ', name: ' New User ', role: 'COMMERCIAL', password } } as Request,
      response as unknown as Response,
      next as NextFunction
    );

    const createInput = repository.create.mock.calls[0][0] as { email: string; passwordHash: string };
    expect(createInput.email).toBe('new.user@example.invalid');
    expect(await bcrypt.compare(password, createInput.passwordHash)).toBe(true);
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ data: createdUser }));
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(password);
    expect(next).not.toHaveBeenCalled();
  });
});
