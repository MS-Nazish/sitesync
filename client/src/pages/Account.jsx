import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { Button, Card, Field, PageHeader } from '../components/ui';

export default function Account() {
  const { user } = useAuth();
  const { t } = useT();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      toast.error(t('acc.mismatch'));
      return;
    }
    setSaving(true);
    try {
      await api.put('/auth/password', form);
      toast.success(t('acc.changed'));
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(await errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={t('acc.title')} subtitle={`${user.name} · ${user.email} · ${t(`role.${user.role}`)}`} />
      <Card title={t('acc.change')} className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('acc.current')}>
            <input className="input" dir="ltr" type="password" required autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} />
          </Field>
          <Field label={t('acc.new')}>
            <input className="input" dir="ltr" type="password" required minLength={6} autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} />
          </Field>
          <Field label={t('acc.repeat')}>
            <input className="input" dir="ltr" type="password" required minLength={6} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
          </Field>
          <Button type="submit" loading={saving}>
            {t('acc.update')}
          </Button>
        </form>
      </Card>
    </>
  );
}
