import { ErrorBoundary, ErrorFallback } from '@components/common';
import { useIsMounted } from '@hooks/useIsMounted';
import { useTranslation } from '@hooks/useTranslation';
import { buildApiUrl, selectMessages, stripEnvelope } from '@lib/ai-signal';
import { useCallback, useEffect, useState } from 'react';
import type { GithubIssue, SignalMessage } from '@/types/ai-signal';

type Status = 'idle' | 'loading' | 'ready' | 'error';

function MessageCard({ message }: { message: SignalMessage }) {
  const { t } = useTranslation();

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <header className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-gray-800 dark:text-gray-200">{message.envelope?.from ?? message.author}</span>
        {message.envelope && (
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-gray-500 text-xs dark:text-gray-400">
            {message.envelope.intent}
          </span>
        )}
        <span className={message.open ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
          {message.open ? t('aiSignal.statusOpen') : t('aiSignal.statusClosed')}
        </span>
        <a className="ml-auto text-primary hover:underline" href={message.url} rel="noopener noreferrer" target="_blank">
          #{message.id}
        </a>
      </header>
      <p className="text-gray-700 dark:text-gray-300">{stripEnvelope(message.body)}</p>
    </article>
  );
}

export default function SignalThread() {
  const { t } = useTranslation();
  const isMounted = useIsMounted();
  const [status, setStatus] = useState<Status>('idle');
  const [messages, setMessages] = useState<SignalMessage[]>([]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      // buildApiUrl validates the origin before anything leaves the browser.
      const response = await fetch(buildApiUrl(), { headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
      setMessages(selectMessages((await response.json()) as GithubIssue[]));
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
