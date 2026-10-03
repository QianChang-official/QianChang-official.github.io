import { ErrorBoundary, ErrorFallback } from '@components/common';
import { useIsMounted } from '@hooks/useIsMounted';
import { useTranslation } from '@hooks/useTranslation';
import { assertApiUrl, buildListUrl, parseRecord, selectEntries } from '@lib/ai-signal';
import { useCallback, useEffect, useState } from 'react';
import type { GithubContentEntry, SignalMessage, SignalRecord } from '@/types/ai-signal';

type Status = 'loading' | 'ready' | 'error';

/** Newest last in the DOM, which reads like a conversation. */
async function loadThread(): Promise<SignalMessage[]> {
  const listingResponse = await fetch(buildListUrl(), { headers: { Accept: 'application/vnd.github+json' } });
  if (!listingResponse.ok) throw new Error(`listing ${listingResponse.status}`);

  // A repo can hold more files than we want to fetch; the newest are the
  // relevant ones, and selectEntries sorts oldest first, so take from the end.
  const entries = selectEntries((await listingResponse.json()) as GithubContentEntry[]).slice(-40);

  const loaded = await Promise.all(
    entries.map(async (entry): Promise<SignalMessage | null> => {
      const response = await fetch(assertApiUrl(entry.download_url).toString());
      if (!response.ok) return null;
      const record = parseRecord((await response.json()) as unknown) as SignalRecord | null;
      return record ? { ...record, file: entry.name, url: entry.download_url } : null;
    }),
  );

  return loaded.filter((m): m is SignalMessage => m !== null);
}

function MessageCard({ message }: { message: SignalMessage }) {
  const { t } = useTranslation();
  const mine = message.role === 'operator';

  return (
    <article className={`rounded-lg border p-4 shadow-sm ${mine ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
      <header className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-gray-800 dark:text-gray-200">{message.from}</span>
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-gray-500 text-xs dark:text-gray-400">
          {message.intent}
        </span>
        {message.inReplyTo && (
          <span className="text-gray-400 text-xs">
            {t('aiSignal.inReplyTo')} <span className="font-mono">{message.inReplyTo}</span>
          </span>
        )}
        <time className="ml-auto text-gray-400 text-xs" dateTime={message.sent}>
          {message.sent.slice(0, 16).replace('T', ' ')}
        </time>
      </header>
      <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{message.text}</p>
    </article>
  );
}

export default function SignalThread() {
  const { t } = useTranslation();
  const isMounted = useIsMounted();
  const [status, setStatus] = useState<Status>('loading');
  const [messages, setMessages] = useState<SignalMessage[]>([]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setMessages(await loadThread());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isMounted) return null;

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="flex flex-col gap-4">
        {status === 'loading' && <p className="text-gray-500 dark:text-gray-400">{t('aiSignal.loading')}</p>}

        {status === 'error' && (
          <div className="rounded-lg border border-border border-dashed p-4 text-sm">
            <p className="mb-2 text-gray-600 dark:text-gray-400">{t('aiSignal.loadError')}</p>
            <button
              className="rounded border border-border px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => void load()}
              type="button"
            >
              {t('aiSignal.retry')}
            </button>
          </div>
        )}

        {status === 'ready' && messages.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">{t('aiSignal.empty')}</p>
        )}

        {messages.map((message) => (
          <MessageCard key={message.id} message={message} />
        ))}
      </div>
    </ErrorBoundary>
  );
}
