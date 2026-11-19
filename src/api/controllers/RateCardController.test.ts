import { NextFunction, Request, Response } from 'express';
import { RateCardController } from './RateCardController';

function createHarness(repositoryOverrides: Record<string, unknown> = {}) {
  const repository = {
    findActive: jest.fn(),
    findLinesByRateCard: jest.fn(),
    create: jest.fn(),
    addLine: jest.fn(),
    activate: jest.fn(),
    ...repositoryOverrides,
  };
  const controller = new RateCardController(repository as never);
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  return { controller, repository, response, next };
}

describe('RateCardController administration', () => {
  test('does not activate an empty rate card', async () => {
    const { controller, repository, response, next } = createHarness({
      activate: jest.fn().mockResolvedValue('EMPTY'),
    });

    await controller.activate(
      { params: { id: '10000000-0000-4000-8000-000000000001' } } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(repository.activate).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(response.json).not.toHaveBeenCalled();
  });

  test('rejects numeric values sent as strings for a rate line', async () => {
    const { controller, repository, response, next } = createHarness();

    await controller.addLine(
      {
        params: { id: '10000000-0000-4000-8000-000000000001' },
        body: {
          formatId: '20000000-0000-4000-8000-000000000001',
          daypart: 'DAY',
          channel: 'GABON 1ère',
          grossPrice: '500000',
          discountMaxPct: 0,
          currency: 'XAF',
          isNegotiable: true,
        },
      } as unknown as Request,
      response as unknown as Response,
      next as NextFunction
    );

    expect(repository.addLine).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(response.status).not.toHaveBeenCalled();
  });
});
