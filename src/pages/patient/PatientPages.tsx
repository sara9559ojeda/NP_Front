import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { me } from '../../api/endpoints';
import { levelLabel, RecommendationTag, SessionDetailView, SessionsTable, StatCard, ToleranceChart } from '../../components/Clinical';
import { Alert, EmptyState, ErrorState, Loading } from '../../components/Feedback';
import { PageHeader } from '../../components/Layout';
import { PairingCodePanel } from '../../components/PairingCodePanel';
import { errorMessage, useApi, usePaged } from '../../hooks/useApi';
import { formatDate, t } from '../../i18n';

const sessionLink = (id: string) => `/paciente/sesiones/${id}`;

/** HU-05: progress between sessions. */
export function PatientProgressPage() {
  const { data, error, loading, reload } = useApi(() => me.progress(), []);
  return (
    <>
      <PageHeader title={t('progress.title')} lead={t('progress.lead')} />
      {loading && <Loading />}
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div className="stack">
          <div className="stats">
            <StatCard label={t('stats.sessions')} value={String(data.sessionsCount)} />
            <StatCard label={t('stats.levelReached')} value={levelLabel(data.levelReached)} />
            {data.allowedStartLevel !== undefined && (
              <StatCard label={t('stats.allowedStartLevel')} value={levelLabel(data.allowedStartLevel)} />
            )}
            <StatCard label={t('stats.lastRecommendation')}>
              <RecommendationTag value={data.lastSessions.find((s) => s.recommendation)?.recommendation} />
            </StatCard>
          </div>
          <section className="card" aria-labelledby="chart-title">
            <h2 id="chart-title">{t('chart.tolerance.title')}</h2>
            <ToleranceChart sessions={data.lastSessions} />
          </section>
          <section className="card" aria-labelledby="history-title">
            <h2 id="history-title">{t('sessions.title')}</h2>
            <SessionsTable sessions={data.lastSessions} linkTo={sessionLink} caption={t('sessions.title')} />
          </section>
        </div>
      )}
    </>
  );
}

export function PatientSessionsPage() {
  const { items, error, loading, hasMore, loadMore, reload } = usePaged((cursor) => me.sessions({ cursor }), []);
  return (
    <>
      <PageHeader title={t('sessions.myTitle')} />
      <section className="card">
        {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
        {!loading || items.length ? <SessionsTable sessions={items} linkTo={sessionLink} caption={t('sessions.myTitle')} /> : null}
        {loading && <Loading />}
        {hasMore && !loading && (
          <button type="button" className="btn btn--ghost" onClick={loadMore}>
            {t('common.loadMore')}
          </button>
        )}
      </section>
    </>
  );
}

export function PatientSessionPage() {
  const { sessionId = '' } = useParams();
  const { data, error, loading, reload } = useApi(() => me.session(sessionId), [sessionId]);
  return (
    <>
      <PageHeader
        title={t('session.title')}
        lead={data ? t('session.subtitle', { date: formatDate(data.startedAt) }) : undefined}
        actions={
          <Link to="/paciente/sesiones" className="btn btn--ghost">
            {t('session.backToList')}
          </Link>
        }
      />
      {loading && <Loading />}
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {data && <SessionDetailView detail={data} />}
    </>
  );
}

/** Pairing codes and device revocation (§6.1, D20). */
export function PatientDevicesPage() {
  const { data, error, loading, reload } = useApi(() => me.devices(), []);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const revoke = async (deviceId: string) => {
    setNotice(null);
    try {
      await me.revokeDevice(deviceId);
      setConfirmId(null);
      setNotice({ tone: 'success', text: t('devices.revokeDone') });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader title={t('devices.title')} lead={t('devices.lead')} />
      <div className="grid-2">
        <section className="card" aria-labelledby="pairing-title">
          <h2 id="pairing-title">{t('pairing.title')}</h2>
          <PairingCodePanel create={() => me.createPairingCode()} />
        </section>
        <section className="card" aria-labelledby="devices-title">
          <h2 id="devices-title">{t('devices.list.title')}</h2>
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
          {loading && <Loading />}
          {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
          {data && data.items.length === 0 && <EmptyState>{t('devices.empty')}</EmptyState>}
          {data && data.items.length > 0 && (
            <ul className="device-list">
              {data.items.map((device) => (
                <li key={device.deviceId} className="device">
                  <dl className="device__meta">
                    <div>
                      <dt>{t('devices.model')}</dt>
                      <dd>{device.model}</dd>
                    </div>
                    <div>
                      <dt>{t('devices.appVersion')}</dt>
                      <dd>{device.appVersion}</dd>
                    </div>
                    <div>
                      <dt>{t('devices.pairedAt')}</dt>
                      <dd>{formatDate(device.pairedAt)}</dd>
                    </div>
                    <div>
                      <dt>{t('devices.status')}</dt>
                      <dd>
                        {device.revokedAt ? (
                          <span className="chip chip--muted">{t('devices.revokedAt', { date: formatDate(device.revokedAt) })}</span>
                        ) : (
                          <span className="chip chip--ok">{t('devices.active')}</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  {!device.revokedAt &&
                    (confirmId === device.deviceId ? (
                      <div className="confirm" role="group" aria-label={t('devices.revokeLabel', { model: device.model })}>
                        <p>{t('devices.revokeConfirm')}</p>
                        <div className="row">
                          <button type="button" className="btn btn--danger btn--sm" onClick={() => revoke(device.deviceId)}>
                            {t('devices.revoke')}
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmId(null)}>
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setConfirmId(device.deviceId)}
                        aria-label={t('devices.revokeLabel', { model: device.model })}
                      >
                        {t('devices.revoke')}
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
