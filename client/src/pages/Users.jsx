import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, UserCog } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useApi, useSites } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { Avatar, Badge, Button, Card, EmptyState, Field, Ltr, Modal, PageHeader, Spinner } from '../components/ui';

const EMPTY = { name: '', email: '', phone: '', password: '', role: 'supervisor', assignedSites: [], active: true };

function UserForm({ open, user, sites, onClose, onSaved }) {
  const { t } = useT();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(user ? { ...EMPTY, ...user, password: '', assignedSites: user.assignedSites.map((s) => s._id) } : EMPTY);
  }, [open, user]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const toggleSite = (id) =>
    setForm((f) => ({
      ...f,
      assignedSites: f.assignedSites.includes(id) ? f.assignedSites.filter((s) => s !== id) : [...f.assignedSites, id],
    }));

  const submit = async (e) => {
    e.preventDefault();
    const body = { ...form };
    if (!body.password) delete body.password;
    setSaving(true);
    try {
      if (user) await api.put(`/users/${user._id}`, body);
      else await api.post('/users', body);
      toast.success(user ? t('users.updated') : t('users.created'));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(await errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={user ? t('common.editName', { name: user.name }) : t('users.new')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="user-form" loading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('users.name')}>
          <input className="input" required value={form.name} onChange={set('name')} />
        </Field>
        <Field label={t('common.phone')}>
          <input className="input" dir="ltr" value={form.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label={t('users.email')}>
          <input className="input" dir="ltr" type="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label={user ? t('users.newPassword') : t('users.passwordReq')} hint={user ? t('users.keepPassword') : t('users.min6')}>
          <input
            className="input"
            dir="ltr"
            type="password"
            minLength={6}
            required={!user}
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
        </Field>
        <Field label={t('users.role')}>
          <select className="input" value={form.role} onChange={set('role')}>
            <option value="supervisor">{t('users.roleSupervisor')}</option>
            <option value="admin">{t('users.roleAdmin')}</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          {t('users.active')}
        </label>
        {form.role === 'supervisor' && (
          <div className="sm:col-span-2">
            <span className="label">{t('users.assigned')}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {sites.map((s) => (
                <label key={s._id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={form.assignedSites.includes(s._id)} onChange={() => toggleSite(s._id)} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const { t } = useT();
  const { sites } = useSites();
  const { data: users, loading, reload } = useApi('/users');
  const [editing, setEditing] = useState(null);

  return (
    <>
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        actions={
          <Button icon={Plus} onClick={() => setEditing({})}>
            {t('users.new')}
          </Button>
        }
      />
      <Card bodyClass="p-0">
        {loading && !users ? (
          <Spinner />
        ) : !users?.length ? (
          <EmptyState icon={UserCog} title={t('users.none')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('users.user')}</th>
                  <th>{t('users.role')}</th>
                  <th>{t('users.sites')}</th>
                  <th>{t('common.phone')}</th>
                  <th>{t('common.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <p className="font-semibold">
                            {u.name}
                            {u._id === me._id && <span className="ms-1 text-xs text-slate-400">({t('common.you')})</span>}
                          </p>
                          <p className="text-xs text-slate-500">
                            <Ltr>{u.email}</Ltr>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge color={u.role === 'admin' ? 'purple' : 'blue'}>{t(`role.${u.role}`)}</Badge>
                    </td>
                    <td className="max-w-xs truncate text-slate-600">
                      {u.role === 'admin' ? t('common.allSites') : u.assignedSites.map((s) => s.name).join('، ') || <Badge color="yellow">{t('common.none')}</Badge>}
                    </td>
                    <td className="text-slate-600">{u.phone ? <Ltr>{u.phone}</Ltr> : '—'}</td>
                    <td>{u.active ? <Badge color="green">{t('common.active')}</Badge> : <Badge>{t('common.disabled')}</Badge>}</td>
                    <td>
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(u)}>
                        {t('common.edit')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <UserForm open={Boolean(editing)} user={editing?._id ? editing : null} sites={sites} onClose={() => setEditing(null)} onSaved={reload} />
    </>
  );
}
