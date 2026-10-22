import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HardHat, Plus, Search } from 'lucide-react';
import { useApi, useSites } from '../hooks/useApi';
import { useT } from '../i18n/LanguageContext';
import { Avatar, Badge, Button, Card, EmptyState, Ltr, PageHeader, SiteSelect, Spinner } from '../components/ui';
import WorkerForm from '../components/WorkerForm';
import { money, SKILLS } from '../utils/format';

export default function Workers() {
  const navigate = useNavigate();
  const { t } = useT();
  const { sites } = useSites();
  const [filters, setFilters] = useState({ site: '', search: '', skill: '', active: 'true' });
  const { data: workers, loading, reload } = useApi('/workers', {
    site: filters.site || undefined,
    search: filters.search || undefined,
    skill: filters.skill || undefined,
    active: filters.active,
  });
  const [formOpen, setFormOpen] = useState(false);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const dailyBill = (workers || []).filter((w) => w.active).reduce((s, w) => s + w.dailyWage, 0);

  return (
    <>
      <PageHeader
        title={t('workers.title')}
        subtitle={workers ? t('workers.subtitle', { n: workers.length, amount: money(dailyBill) }) : ' '}
        actions={
          <Button icon={Plus} onClick={() => setFormOpen(true)} disabled={!sites.length}>
            {t('workers.add')}
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="input ps-9" placeholder={t('workers.search')} value={filters.search} onChange={(e) => set('search', e.target.value)} />
          </div>
          <SiteSelect sites={sites} value={filters.site} onChange={(v) => set('site', v)} allowAll />
          <select className="input" value={filters.skill} onChange={(e) => set('skill', e.target.value)}>
            <option value="">{t('workers.allSkills')}</option>
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                {t(`skill.${s}`)}
              </option>
            ))}
          </select>
          <select className="input" value={filters.active} onChange={(e) => set('active', e.target.value)}>
            <option value="true">{t('workers.activeOnly')}</option>
            <option value="false">{t('workers.inactiveOnly')}</option>
            <option value="all">{t('workers.all')}</option>
          </select>
        </div>
      </Card>

      <Card bodyClass="p-0">
        {loading && !workers ? (
          <Spinner />
        ) : !workers?.length ? (
          <EmptyState icon={HardHat} title={t('workers.none')}>
            {t('workers.noneHint')}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.worker')}</th>
                  <th>{t('workers.skill')}</th>
                  <th>{t('common.site')}</th>
                  <th>{t('common.phone')}</th>
                  <th className="text-end">{t('workers.dailyWage')}</th>
                  <th className="text-end">{t('workers.otHour')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w._id} className="cursor-pointer" onClick={() => navigate(`/workers/${w._id}`)}>
                    <td>
                      <Link to={`/workers/${w._id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <Avatar name={w.name} src={w.photo} size="sm" />
                        <span className="font-semibold text-slate-800">{w.name}</span>
                      </Link>
                    </td>
                    <td>{t(`skill.${w.skill}`)}</td>
                    <td className="text-slate-600">{w.site?.name}</td>
                    <td className="text-slate-600">{w.phone ? <Ltr>{w.phone}</Ltr> : '—'}</td>
                    <td className="text-end font-semibold">{money(w.dailyWage)}</td>
                    <td className="text-end text-slate-600">{money(w.effectiveOvertimeRate)}</td>
                    <td>{w.active ? <Badge color="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <WorkerForm
        open={formOpen}
        sites={sites.filter((s) => s.status !== 'completed')}
        defaultSite={filters.site}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
      />
    </>
  );
}
