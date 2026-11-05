import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { me } from '../../api/endpoints';
import type { TherapyState } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { FeedbackSummary, levelLabel, SessionDetailView, SessionsTable, SummaryList, ToleranceChart } from '../../components/Clinical';
import { PageHeader } from '../../components/Layout';
import { PairingCodePanel } from '../../components/PairingCodePanel';
import { TherapyPanel } from '../../components/therapy/TherapyPanel';
import { Alert, EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { riseOrder } from '../../components/ui/rise';
import { errorMessage, useApi, usePaged } from '../../hooks/useApi';
import { formatDate, formatLongDate, formatNumber, t } from '../../i18n';

const sessionLink = (id: string) => `/paciente/sesiones/${id}`;

function LastFeedbackCard({ therapy }: { therapy: TherapyState }) {
  return (
    <section className="card rise" style={riseOrder(3)} aria-labelledby="last-feedback-title">
      <h2 id="last-feedback-title">{t('feedback.lastTitle')}</h2>
      {therapy.lastFeedback ? (
        <FeedbackSummary feedback={therapy.lastFeedback} audience="patient" />
      ) : (
        <EmptyState>{t('feedback.none')}</EmptyState>
      )}
    </section>
  );
}

function HeadsetCard({ therapy }: { therapy: TherapyState }) {
  return (
    <section className="card rise" style={riseOrder(4)} aria-labelledby="headset-title">
      <h2 id="headset-title">{t('devices.title')}</h2>
      <p className="muted">{therapy.pairedDevices > 0 ? t('therapy.devices.count', { n: therapy.pairedDevices }) : t('therapy.devices.none')}</p>
      <p>
        <Link to="/paciente/visor" viewTransition>
          {t('therapy.devices.manage')}
        </Link>
      </p>
    </section>
  );
}

function ProgressSection() {
  const { data, error, loading, reload } = useApi(() => me.progress(), []);
  const latest = data?.lastSessions.find((s) => typeof s.toleranceIndex === 'number');
  return (
    <section className="card rise home-grid__wide" style={riseOrder(4)} aria-labelledby="progress-title">
      <h2 id="progress-title">{t('progress.title')}</h2>
      {loading && !data && <Loading />}
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div className="stack">
          <SummaryList
            items={[
              { label: t('stats.sessions'), value: data.sessionsCount },
              { label: t('stats.levelReached'), value: levelLabel(data.levelReached) },
              { label: t('stats.latestTolerance'), value: formatNumber(latest?.toleranceIndex, 2) },
            ]}
          />
          <ToleranceChart sessions={data.lastSessions} />
          <SessionsTable sessions={data.lastSessions} linkTo={sessionLink} caption={t('sessions.title')} />
        </div>
      )}
    </section>
  );
}

/** Patient home: today's session (adjust grade and start), last feedback and progress (HU-05). */
export function PatientHomePage() {
  const { user } = useAuth();
  const therapy = useApi(() => me.therapy(), []);
  const firstName = user?.fullName.split(' ')[0] ?? '';
  return (
    <>
      <PageHeader eyebrow={formatLongDate(new Date())} title={t('patientHome.title', { name: firstName })} lead={t('patientHome.lead')} />
      <div className="home-grid">
        <div className="rise" style={riseOrder(2)}>
          {therapy.loading && !therapy.data && <Loading />}
          {Boolean(therapy.error) && !therapy.data && <ErrorState error={therapy.error} onRetry={therapy.reload} />}
          {therapy.data && <TherapyPanel therapy={therapy.data} onRefresh={therapy.reload} />}
        </div>
        {therapy.data && (
          <div className="stack">
            <LastFeedbackCard therapy={therapy.data} />
            <HeadsetCard therapy={therapy.data} />
          </div>
        )}
        <ProgressSection />
      </div>
    </>
  );
}

export function PatientSessionsPage() {
  const { items, error, loading, hasMore, loadMore, reload } = usePaged((cursor) => me.sessions({ cursor }), []);
  return (
    <>
      <PageHeader title={t('sessions.myTitle')} />
      <section className="card stack">
        {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
        {!loading || items.length ? <SessionsTable sessions={items} linkTo={sessionLink} caption={t('sessions.myTitle')} /> : null}
        {loading && <Loading />}
        {hasMore && !loading && (
          <button type="button" className="btn" onClick={loadMore}>
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
          <Link to="/paciente/sesiones" className="btn" viewTransition>
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
        <section className="card stack" aria-labelledby="devices-title">
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
                          <span className="tag tag--muted">{t('devices.revokedAt', { date: formatDate(device.revokedAt) })}</span>
                        ) : (
                          <span className="tag">{t('devices.active')}</span>
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
                          <button type="button" className="btn btn--sm" onClick={() => setConfirmId(null)}>
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--sm"
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
