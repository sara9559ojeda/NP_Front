import { useState } from 'react';
import { Link } from 'react-router';
import { publicInfo } from '../../api/endpoints';
import { ApiError, requestRaw } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/Layout';
import { Alert, ErrorState, Loading } from '../../components/ui/Feedback';
import { useApi } from '../../hooks/useApi';
import { formatDate, t } from '../../i18n';

const STEPS = ['prepare', 'install', 'account', 'pair', 'session', 'review'] as const;

export function InstallationPage() {
  const { user } = useAuth();
  const release = useApi(() => publicInfo.appRelease(), []);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<unknown>(null);

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await requestRaw('/admin/app-release/download');
      if (!response.headers.get('Content-Type')?.startsWith('application/vnd.android.package-archive')) {
        throw new ApiError(502, 'INVALID_DOWNLOAD');
      }
      const file = await response.blob();
      const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (file.size !== release.data?.bytes || signature.join(',') !== '80,75,3,4') {
        throw new ApiError(502, 'INVALID_DOWNLOAD');
      }
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'neurophobia.apk';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setDownloadError(error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="wrap page installation">
      <PageHeader title={t('installation.title')} lead={t('installation.lead')} />
      <section className="card stack" aria-labelledby="installation-release">
        <h2 id="installation-release">{t('installation.release.title')}</h2>
        {release.loading && <Loading />}
        {Boolean(release.error) && <ErrorState error={release.error} onRetry={release.reload} />}
        {release.data && (
          <>
            <Alert tone={release.data.status === 'available' ? 'info' : 'warning'}>
              <p>{t(`installation.release.${release.data.status}`)}</p>
            </Alert>
            {release.data.version && (
              <dl className="metrics">
                <div><dt>{t('installation.release.version')}</dt><dd>{release.data.version}</dd></div>
                <div><dt>{t('installation.release.date')}</dt><dd>{formatDate(release.data.createdAt)}</dd></div>
                <div><dt>{t('installation.release.size')}</dt><dd>{t('installation.release.bytes', { size: new Intl.NumberFormat('es', { maximumFractionDigits: 1 }).format((release.data.bytes ?? 0) / 1048576) })}</dd></div>
              </dl>
            )}
            {release.data.sha256 && <p className="installation__checksum mono small">{t('installation.release.checksum', { hash: release.data.sha256 })}</p>}
            <p>{t('installation.release.access')}</p>
            {user?.role === 'admin' && release.data.status === 'available' && (
              <button type="button" className="btn btn--primary" disabled={downloading} onClick={download}>
                {t(downloading ? 'installation.release.downloading' : 'installation.release.download')}
              </button>
            )}
          </>
        )}
        {Boolean(downloadError) && <ErrorState error={downloadError} onRetry={download} />}
      </section>
      <section className="stack" aria-labelledby="installation-steps">
        <h2 id="installation-steps">{t('installation.steps.title')}</h2>
        <ol className="installation__steps">
          {STEPS.map(step => (
            <li key={step} className="card stack">
              <h3>{t(`installation.step.${step}.title`)}</h3>
              <p>{t(`installation.step.${step}.body`)}</p>
              {step === 'install' && <a href="https://developers.meta.com/vr/documentation/native/android/ts-adb/" target="_blank" rel="noreferrer">{t('installation.metaGuide')}</a>}
              {step === 'account' && <Link to="/registro">{t('home.cta.register')}</Link>}
              {step === 'pair' && <Link to="/paciente/visor">{t('installation.openPairing')}</Link>}
            </li>
          ))}
        </ol>
      </section>
      <section className="card stack" aria-labelledby="installation-help">
        <h2 id="installation-help">{t('installation.help.title')}</h2>
        <p>{t('installation.help.network')}</p>
        <p>{t('installation.help.code')}</p>
        <p>{t('installation.help.feedback')}</p>
      </section>
    </div>
  );
}
