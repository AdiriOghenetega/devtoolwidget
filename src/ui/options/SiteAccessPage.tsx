import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Button } from '../design-system/primitives/Button';
import { t } from '../i18n';

/** Outcome of requesting access to a site. */
export type AllowResult = 'granted' | 'denied';

/**
 * The data and actions the site-access page drives. Wired to `chrome.*` in the
 * options entrypoint so the component stays testable and framework-free.
 */
export interface SiteAccessPorts {
  listGranted(): Promise<readonly string[]>;
  currentOrigin(): Promise<string | undefined>;
  allow(origin: string): Promise<AllowResult>;
  revoke(origin: string): Promise<void>;
}

/** Props for {@link SiteAccessPage}. */
export interface SiteAccessPageProps {
  readonly ports: SiteAccessPorts;
}

/**
 * The options page's site-access section (FR-15, G12). It lists the sites the
 * user has allowed, offers a plain-language grant button for the current site,
 * and a remove button per site. New installs allow no sites, so the extension is
 * off everywhere until the user opts in. The grant button is the user gesture
 * that `chrome.permissions.request` requires.
 */
export function SiteAccessPage({ ports }: SiteAccessPageProps): JSX.Element {
  const [granted, setGranted] = useState<readonly string[]>([]);
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const refresh = async (): Promise<void> => {
    const [list, origin] = await Promise.all([ports.listGranted(), ports.currentOrigin()]);
    setGranted([...list].sort((a, b) => a.localeCompare(b)));
    setCurrent(origin);
  };

  useEffect(() => {
    void refresh();
  });

  const allow = (origin: string): void => {
    setBusy(true);
    setMessage(undefined);
    void ports.allow(origin).then(async (result) => {
      setMessage(describeAllow(result, origin));
      await refresh();
      setBusy(false);
    });
  };

  const revoke = (origin: string): void => {
    setBusy(true);
    void ports.revoke(origin).then(async () => {
      setMessage(t('siteAccess.revoked', { site: origin }));
      await refresh();
      setBusy(false);
    });
  };

  const currentAllowed = current !== undefined && granted.includes(current);

  return (
    <main class="dwt-options" aria-label={t('siteAccess.title')}>
      <h1>{t('siteAccess.title')}</h1>
      <p>{t('siteAccess.intro')}</p>
      <p class="dwt-options__note">{t('siteAccess.portNote')}</p>

      <section aria-label={t('siteAccess.title')}>
        {current === undefined ? (
          <p>{t('siteAccess.openTab')}</p>
        ) : currentAllowed ? (
          <p role="status">{t('siteAccess.already', { site: current })}</p>
        ) : (
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              allow(current);
            }}
          >
            {t('siteAccess.allow', { site: current })}
          </Button>
        )}

        {granted.length === 0 ? (
          <p>{t('siteAccess.none')}</p>
        ) : (
          <ul class="dwt-options__sites">
            {granted.map((origin) => (
              <li key={origin}>
                <span>{origin}</span>
                <Button
                  disabled={busy}
                  ariaLabel={`${t('siteAccess.revoke')} ${origin}`}
                  onClick={() => {
                    revoke(origin);
                  }}
                >
                  {t('siteAccess.revoke')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message !== undefined && (
        <p role="status" class="dwt-options__status">
          {message}
        </p>
      )}
    </main>
  );
}

function describeAllow(result: AllowResult, origin: string): string {
  return result === 'denied' ? t('siteAccess.denied') : t('siteAccess.granted', { site: origin });
}
