import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { authenticate } from './authenticate';

describe('authenticate middleware', () => {
  const previousSecret = process.env.JWT_SECRET;
  const userId = '10000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  test('rejects a valid token when the account is inactive', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const token = jwt.sign({ id: userId }, 'test-secret');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();

    await authenticate(db as never)(
      req as Request,
      {} as Response,
      next as NextFunction
    );

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('is_active = TRUE'), [userId]);
    expect(req).not.toHaveProperty('user');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('loads the current role from the active account record', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: userId, email: 'admin@example.invalid', name: 'Admin', role: 'ADMIN', password_version: 0 }],
      }),
    };
    const token = jwt.sign({ id: userId, role: 'COMMERCIAL' }, 'test-secret');
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const next = jest.fn();

    await authenticate(db as never)(req, {} as Response, next as NextFunction);

    expect(req.user).toEqual({
      id: userId,
      email: 'admin@example.invalid',
      name: 'Admin',
      role: 'ADMIN',
    });
    expect(next).toHaveBeenCalledWith();
  });

  test('rejects sessions issued before a password reset', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: userId, email: 'admin@example.invalid', name: 'Admin', role: 'ADMIN', password_version: 2 }],
      }),
    };
    const token = jwt.sign({ id: userId, tokenVersion: 1 }, 'test-secret');
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const next = jest.fn();

    await authenticate(db as never)(req, {} as Response, next as NextFunction);

    expect(req).not.toHaveProperty('user');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
