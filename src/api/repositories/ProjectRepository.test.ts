import { ProjectRepository } from './ProjectRepository';

describe('ProjectRepository.create', () => {
  const projectData = {
    title: 'Campagne test',
    clientId: '10000000-0000-4000-8000-000000000001',
    ownerId: '20000000-0000-4000-8000-000000000001',
    rateCardId: '30000000-0000-4000-8000-000000000001',
  };

  test('does not create a project if the client was deactivated', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({}),
      release: jest.fn(),
    };
    const repository = new ProjectRepository({ connect: jest.fn().mockResolvedValue(client) } as never);

    await expect(repository.create(projectData)).resolves.toBeNull();

    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining('is_active = TRUE FOR SHARE'), [projectData.clientId]);
    expect(client.query.mock.calls.some(([query]) => String(query).includes('INSERT INTO project'))).toBe(false);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('creates a project while holding an active-client lock', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ id: projectData.clientId }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: '40000000-0000-4000-8000-000000000001' }] })
        .mockResolvedValueOnce({}),
      release: jest.fn(),
    };
    const repository = new ProjectRepository({ connect: jest.fn().mockResolvedValue(client) } as never);

    await expect(repository.create(projectData)).resolves.toBe('40000000-0000-4000-8000-000000000001');

    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining('is_active = TRUE FOR SHARE'), [projectData.clientId]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('ProjectRepository.update', () => {
  test('only updates draft projects using an active client', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({ rowCount: 1 }),
    };
    const repository = new ProjectRepository(db as never);

    await expect(repository.update('project-id', {
      title: 'Campagne mise à jour',
      clientId: 'client-id',
      campaignStart: null,
      campaignEnd: null,
      budgetTarget: null,
    })).resolves.toBe(true);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("p.status = 'DRAFT'"),
      ['project-id', 'Campagne mise à jour', 'client-id', null, null, null]
    );
    expect(db.query.mock.calls[0][0]).toContain('c.is_active = TRUE');
  });
});

describe('ProjectRepository.findFollowUps', () => {
  test('limits commercial reminders to the owner’s portfolio', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: 'follow-up-id',
          project_id: 'project-id',
          note: 'Relancer le client',
          due_date: '2027-01-15',
          completed_at: null,
          created_at: '2027-01-01T10:00:00.000Z',
          project_title: 'Campagne test',
          project_reference: 'PRJ-2027-0001',
        }],
      }),
    };
    const repository = new ProjectRepository(db as never);

    await expect(repository.findFollowUps('owner-id')).resolves.toEqual([{
      id: 'follow-up-id',
      projectId: 'project-id',
      note: 'Relancer le client',
      dueDate: '2027-01-15',
      completedAt: null,
      createdAt: '2027-01-01T10:00:00.000Z',
      projectTitle: 'Campagne test',
      projectReference: 'PRJ-2027-0001',
    }]);
    expect(db.query.mock.calls[0][0]).toContain('p.owner_id = $1');
    expect(db.query.mock.calls[0][1]).toEqual(['owner-id']);
  });
});
