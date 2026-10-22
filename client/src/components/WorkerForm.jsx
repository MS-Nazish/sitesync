import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../api/client';
import { useT } from '../i18n/LanguageContext';
import { compressImage } from '../utils/device';
import { SKILLS, todayStr } from '../utils/format';
import { Avatar, Button, Field, Modal, SiteSelect } from './ui';

const EMPTY = {
  name: '',
  fatherName: '',
  phone: '',
  cnic: '',
  skill: 'Helper',
  dailyWage: '',
  overtimeRate: '',
  site: '',
  joinedAt: todayStr(),
};

// Add / edit a worker. Sends multipart form data so a photo can be attached.
export default function WorkerForm({ open, worker, sites, defaultSite, onClose, onSaved }) {
  const { t } = useT();
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      worker
        ? {
            ...EMPTY,
            ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, worker[k] ?? ''])),
            site: worker.site?._id || worker.site,
          }
        : { ...EMPTY, site: defaultSite || sites[0]?._id || '' }
    );
    setPhoto(null);
    setPreview(null);
    // Only reset when the modal opens or the worker changes; `sites` is a new array on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, worker]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const small = await compressImage(file, 600);
    setPhoto(small);
    setPreview(URL.createObjectURL(small));
  };

  const submit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, v ?? ''));
    if (photo) data.append('photo', photo);
    setSaving(true);
    try {
      const res = worker ? await api.put(`/workers/${worker._id}`, data) : await api.post('/workers', data);
      toast.success(worker ? t('wf.updated') : t('wf.added'));
      onSaved(res.data);
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
      title={worker ? t('common.editName', { name: worker.name }) : t('wf.add')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="worker-form" loading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="worker-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 sm:col-span-2">
          <Avatar name={form.name || '?'} src={preview || worker?.photo} size="lg" />
          <label className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">
            {worker?.photo || preview ? t('wf.changePhoto') : t('wf.addPhoto')}
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={onPhoto} />
          </label>
        </div>
        <Field label={t('wf.fullName')}>
          <input className="input" required value={form.name} onChange={set('name')} />
        </Field>
        <Field label={t('wf.fatherName')}>
          <input className="input" value={form.fatherName} onChange={set('fatherName')} />
        </Field>
        <Field label={t('common.phone')} hint={t('wf.phoneHint')}>
          <input className="input" dir="ltr" type="tel" value={form.phone} onChange={set('phone')} placeholder="0300-1234567" />
        </Field>
        <Field label={t('wf.cnic')}>
          <input className="input" dir="ltr" value={form.cnic} onChange={set('cnic')} placeholder="35202-1234567-1" />
        </Field>
        <Field label={t('workers.skill')}>
          <select className="input" value={form.skill} onChange={set('skill')}>
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                {t(`skill.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('wf.site')}>
          <SiteSelect sites={sites} value={form.site} onChange={(v) => setForm({ ...form, site: v })} />
        </Field>
        <Field label={t('wf.dailyWage')}>
          <input className="input" type="number" min="0" required value={form.dailyWage} onChange={set('dailyWage')} />
        </Field>
        <Field label={t('wf.otRate')} hint={t('wf.otRateHint')}>
          <input className="input" type="number" min="0" value={form.overtimeRate} onChange={set('overtimeRate')} />
        </Field>
        <Field label={t('wf.joined')}>
          <input className="input" type="date" value={form.joinedAt} onChange={set('joinedAt')} />
        </Field>
      </form>
    </Modal>
  );
}
