import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Copy, ExternalLink, MessageCircle, MessageSquareText, Send, Share2 } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { Badge, Button, Ltr, Modal, Spinner } from './ui';
import { fmtDateTime, money } from '../utils/format';

const canShareFiles = () => typeof navigator.canShare === 'function';

// Lists every worker in an approved payroll with ready-made WhatsApp / SMS messages for their wage slip
export default function SendSlipsModal({ open, payroll, onClose }) {
  const { t, lang } = useT();
  const { isAdmin } = useAuth();
  const [msgLang, setMsgLang] = useState(lang);
  const [expanded, setExpanded] = useState(null);
  const [sending, setSending] = useState('');
  const { data, loading, reload } = useApi(open ? `/payroll/${payroll._id}/messages` : null, { lang: msgLang });

  const messages = data?.messages || [];
  const withPhone = messages.filter((m) => m.intlPhone).length;
  const provider = data?.provider;

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('ss.copied'));
    } catch {
      window.prompt('', text);
    }
  };

  // On phones: share the actual PDF file to WhatsApp (or any app) through the system share sheet
  const sharePdf = async (m) => {
    try {
      const res = await fetch(m.slipUrl);
      if (!res.ok) throw new Error('Could not load the slip');
      const file = new File([await res.blob()], `wage-slip-${m.name.replace(/\s+/g, '-')}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: m.text });
      else window.open(m.slipUrl, '_blank', 'noopener');
    } catch (err) {
      if (err.name !== 'AbortError') toast.error(err.message);
    }
  };

  const sendFromServer = async (channel) => {
    const label = channel === 'whatsapp' ? t('ss.whatsapp') : t('ss.sms');
    if (!window.confirm(t('ss.serverConfirm', { n: withPhone, channel: label }))) return;
    setSending(channel);
    try {
      const res = await api.post(`/payroll/${payroll._id}/notify`, { channel, lang: msgLang });
      const msg = t('ss.serverResult', { sent: res.data.sent, failed: res.data.failed });
      if (res.data.failed) toast.error(msg);
      else toast.success(msg);
      reload();
    } catch (err) {
      toast.error(await errorMessage(err));
    } finally {
      setSending('');
    }
  };

  return (
    <Modal open={open} title={t('ss.title')} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-lg text-sm text-slate-600">{t('ss.intro')}</p>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{t('ss.language')}</span>
            <select className="input w-auto py-1.5" value={msgLang} onChange={(e) => setMsgLang(e.target.value)}>
              <option value="en">English</option>
              <option value="ur">اردو</option>
            </select>
          </label>
        </div>

        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <p className="text-xs font-semibold text-slate-500">{t('ss.withPhone', { n: withPhone, total: messages.length })}</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {messages.map((m) => (
                <li key={m.worker} className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[160px] flex-1">
                      <p className="font-semibold text-slate-800">{m.name}</p>
                      <p className="text-xs text-slate-500">
                        {m.intlPhone ? <Ltr>{m.phone}</Ltr> : m.phone ? t('ss.badPhone', { phone: m.phone }) : t('ss.noPhone')}
                        {' · '}
                        <strong className="text-slate-700">{money(m.netPay)}</strong>
                      </p>
                      {m.lastSent && (
                        <Badge color="green" className="mt-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('ss.sentAt', { channel: m.lastSent.channel === 'whatsapp' ? t('ss.whatsapp') : t('ss.sms'), time: fmtDateTime(m.lastSent.at) })}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <a
                        href={m.whatsappUrl || undefined}
                        target="_blank"
                        rel="noreferrer"
                        aria-disabled={!m.whatsappUrl}
                        className={`inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1ebe5a] ${!m.whatsappUrl ? 'pointer-events-none opacity-40' : ''}`}
                      >
                        <MessageCircle className="h-4 w-4" /> {t('ss.whatsapp')}
                      </a>
                      <a
                        href={m.smsUrl || undefined}
                        aria-disabled={!m.smsUrl}
                        className={`inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 ${!m.smsUrl ? 'pointer-events-none opacity-40' : ''}`}
                      >
                        <MessageSquareText className="h-4 w-4" /> {t('ss.sms')}
                      </a>
                      {canShareFiles() && (
                        <Button variant="secondary" size="sm" icon={Share2} onClick={() => sharePdf(m)}>
                          {t('ss.share')}
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" icon={Copy} onClick={() => copy(m.text)} aria-label={t('ss.copy')} />
                      <a
                        href={m.slipUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={t('ss.openSlip')}
                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-1 text-xs font-semibold text-brand-700 hover:underline"
                    onClick={() => setExpanded(expanded === m.worker ? null : m.worker)}
                  >
                    {t('ss.preview')}
                  </button>
                  {expanded === m.worker && (
                    <pre dir="auto" className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-[#e7ffdb] p-3 font-sans text-sm text-slate-800">
                      {m.text}
                    </pre>
                  )}
                </li>
              ))}
            </ul>

            {isAdmin && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-700">{t('ss.serverTitle')}</p>
                {provider?.sms || provider?.whatsapp ? (
                  <>
                    <p className="mt-1 text-xs text-slate-500">{t('ss.serverHint', { provider: provider.provider })}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {provider.sms && (
                        <Button variant="dark" size="sm" icon={Send} loading={sending === 'sms'} disabled={!withPhone} onClick={() => sendFromServer('sms')}>
                          {t('ss.serverSms')}
                        </Button>
                      )}
                      {provider.whatsapp && (
                        <Button variant="whatsapp" size="sm" icon={Send} loading={sending === 'whatsapp'} disabled={!withPhone} onClick={() => sendFromServer('whatsapp')}>
                          {t('ss.serverWa')}
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">{t('ss.serverOff')}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
