import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import { projectFollowUpsApi, type ProjectFollowUpDto } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export function ProjectFollowUps({ projectId }: { projectId: string }) {
  const role = useAuthStore((state) => state.user?.role);
  const [items, setItems] = useState<ProjectFollowUpDto[]>([]);
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (role !== 'COMMERCIAL' && role !== 'ADMIN') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await projectFollowUpsApi.listForProject(projectId);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger le suivi du projet.');
    } finally {
      setLoading(false);
    }
  }, [projectId, role]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  if (role !== 'COMMERCIAL' && role !== 'ADMIN') return null;

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedNote = note.trim();
    if (!trimmedNote || !dueDate) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await projectFollowUpsApi.create(projectId, { note: trimmedNote, dueDate });
      setItems((current) => [...current, data].sort(compareFollowUps));
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’ajouter cette action.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCompleted = async (item: ProjectFollowUpDto) => {
    const completed = !item.completedAt;
    setError(null);
    try {
      await projectFollowUpsApi.setCompleted(projectId, item.id, completed);
      setItems((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, completedAt: completed ? new Date().toISOString() : null }
        : entry
      ).sort(compareFollowUps));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour cette action.');
    }
  };

  return (
    <section className="surface-card mt-6 p-5 sm:p-6" aria-labelledby="project-follow-ups-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#009A44]">Organisation commerciale</p>
          <h2 id="project-follow-ups-title" className="mt-1 text-lg font-bold text-slate-900">Actions et rappels</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {items.filter((item) => !item.completedAt).length} en attente
        </span>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={(event) => void createItem(event)} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="block text-xs font-bold text-slate-600">
          Prochaine action
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            required
            className="form-control mt-1.5"
            placeholder="Ex. Relancer l’annonceur pour valider le calendrier"
          />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Échéance
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
            className="form-control mt-1.5"
          />
        </label>
        <button type="submit" disabled={saving || !note.trim()} className="h-11 rounded-lg bg-[#0055B8] px-4 text-sm font-bold text-white hover:bg-[#00338D] disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>

      <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
        {loading ? (
          <p className="py-5 text-sm text-slate-500">Chargement des actions…</p>
        ) : items.length === 0 ? (
          <p className="py-5 text-sm text-slate-500">Aucune action enregistrée pour ce projet.</p>
        ) : items.map((item) => (
          <FollowUpRow key={item.id} item={item} onToggle={() => void toggleCompleted(item)} />
        ))}
      </div>
    </section>
  );
}

function FollowUpRow({ item, onToggle }: { item: ProjectFollowUpDto; onToggle: () => void }) {
  const isOverdue = !item.completedAt && item.dueDate < today();
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={`break-words text-sm font-medium ${item.completedAt ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.note}</p>
        <p className={`mt-1 text-xs ${isOverdue ? 'font-bold text-red-600' : 'text-slate-500'}`}>
          {isOverdue ? 'En retard · ' : 'Échéance · '}{formatDate(item.dueDate)}
        </p>
      </div>
      <button type="button" onClick={onToggle} className="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">
        {item.completedAt ? 'Réactiver' : 'Terminer'}
      </button>
    </div>
  );
}

function compareFollowUps(a: ProjectFollowUpDto, b: ProjectFollowUpDto) {
  return Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) ||
    a.dueDate.localeCompare(b.dueDate) ||
    b.createdAt.localeCompare(a.createdAt);
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}
