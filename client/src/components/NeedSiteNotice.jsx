import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { Button } from './ui';

// Workers and advances belong to a site, so explain why "Add" is unavailable until one exists
export default function NeedSiteNotice() {
  const { isAdmin } = useAuth();
  const { t } = useT();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Building2 className="h-5 w-5 shrink-0" />
      <p className="min-w-0 flex-1">
        <strong>{t('needSite.title')}</strong> {isAdmin ? t('needSite.admin') : t('needSite.supervisor')}
      </p>
      {isAdmin && (
        <Link to="/sites">
          <Button size="sm">{t('needSite.button')}</Button>
        </Link>
      )}
    </div>
  );
}
