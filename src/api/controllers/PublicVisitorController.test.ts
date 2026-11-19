import { NextFunction, Request, Response } from 'express';
import { PublicVisitorController } from './PublicVisitorController';

function createHarness(repositoryOverrides: Record<string, unknown> = {}) {
  const repository = {
    getCatalog: jest.fn(),
    scoreOptions: jest.fn(),
    submit: jest.fn().mockResolvedValue({ reference: 'GTV-DEMO-1', token: 'opaque-token' }),
    track: jest.fn(),
    findRequests: jest.fn(),
    updateRequestStatus: jest.fn(),
    ...repositoryOverrides,
  };
  const controller = new PublicVisitorController(repository as never);
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();
  return { controller, repository, response, next };
}

const validPayload = {
  rateCardId: null,
  brief: {
    objective: 'NOTORIETE',
    targetSegment: null,
    budgetHT: null,
    periodStart: null,
    periodEnd: null,
    sectorCode: null,
  },
  contact: {
    companyName: 'DEMO_FICTIF',
    fullName: 'DEMO_FICTIF',
    email: 'visitor@example.invalid',
    phone: null,
    city: null,
    consentMarketing: false,
  },
  selections: [],
  message: null,
};

describe('PublicVisitorController', () => {
  test('accepts a no-account request without budget, audience, or selected rates', async () => {
    const { controller, repository, response, next } = createHarness();

    await controller.submitRequest(
      { body: validPayload } as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(repository.submit).toHaveBeenCalledWith(expect.objectContaining({
      rateCardId: null,
      brief: expect.objectContaining({ budgetHT: null, targetSegment: null }),
      selections: [],
    }));
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an invalid objective without persisting personal data', async () => {
    const { controller, repository, response, next } = createHarness();
    const payload = { ...validPayload, brief: { ...validPayload.brief, objective: 'UNKNOWN' } };

    await controller.submitRequest(
      { body: payload } as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(repository.submit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  test('rejects an invalid email before persisting contact details', async () => {
    const { controller, repository, response, next } = createHarness();
    const payload = {
      ...validPayload,
      contact: { ...validPayload.contact, email: 'not-an-email' },
    };

    await controller.submitRequest(
      { body: payload } as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(repository.submit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  test('rejects malformed tracking tokens before looking them up', async () => {
    const { controller, repository, response, next } = createHarness();

    await controller.trackRequest(
      { params: { token: 'short' } } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(repository.track).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
});
