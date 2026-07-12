'use client';

import { useEffect, useState } from 'react';

type User = {
  id: number;
  username: string;
  role: string;
  created_at: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [changingPassId, setChangingPassId] = useState<number | null>(null);
  const [newPass, setNewPass] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  async function fetchUsers() {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
    });

    setCreating(false);

    if (res.ok) {
      setSuccess(`Lietotājs "${newUsername}" izveidots!`);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Kļūda');
    }
  }

  async function handleDelete(id: number, username: string) {
    if (!confirm(`Dzēst lietotāju "${username}"?`)) return;
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchUsers();
  }

  async function handleChangePassword(id: number) {
    if (!newPass) return;
    setSavingPass(true);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: newPass }),
    });
    setSavingPass(false);
    setChangingPassId(null);
    setNewPass('');
  }

  return (
    <div className="container mx-auto px-4 pt-20 pb-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-8">
        Admin panelis
      </h1>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 mb-8">
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">Pievienot lietotāju</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--foreground)]/70 mb-1.5">Lietotājvārds</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                placeholder="lietotajvards"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--foreground)]/70 mb-1.5">Parole</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[var(--foreground)]/70 mb-1.5">Loma</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
              className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
            >
              <option value="user">Lietotājs</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-[var(--primary-light)] bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg px-4 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-2">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 transition-colors text-sm"
          >
            {creating ? 'Veido...' : 'Pievienot'}
          </button>
        </form>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Lietotāji ({users.length})
          </h2>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-[var(--foreground)]/40 text-sm">Ielādē...</div>
        ) : users.length === 0 ? (
          <div className="px-6 py-8 text-center text-[var(--foreground)]/40 text-sm">Nav lietotāju</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {users.map((user) => (
              <div key={user.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-[var(--foreground)]">{user.username}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      user.role === 'admin'
                        ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
                        : 'bg-[var(--surface-2)] text-[var(--foreground)]/50'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'Lietotājs'}
                    </span>
                    <p className="text-xs text-[var(--foreground)]/30 mt-0.5">
                      {new Date(user.created_at).toLocaleDateString('lv-LV')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setChangingPassId(changingPassId === user.id ? null : user.id); setNewPass(''); }}
                      className="text-xs text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors"
                    >
                      Mainīt paroli
                    </button>
                    <button
                      onClick={() => handleDelete(user.id, user.username)}
                      className="text-xs text-[var(--foreground)]/30 hover:text-[var(--primary)] transition-colors"
                    >
                      Dzēst
                    </button>
                  </div>
                </div>
                {changingPassId === user.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="password"
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="Jaunā parole"
                      className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                    />
                    <button
                      onClick={() => handleChangePassword(user.id)}
                      disabled={savingPass || !newPass}
                      className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-4 py-1.5 transition-colors"
                    >
                      {savingPass ? 'Saglabā...' : 'Saglabāt'}
                    </button>
                    <button
                      onClick={() => { setChangingPassId(null); setNewPass(''); }}
                      className="text-xs text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors px-2"
                    >
                      Atcelt
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
