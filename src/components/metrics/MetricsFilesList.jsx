// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, FileImage, FileText } from 'lucide-react';
import { C } from '@/lib/theme';

const PREVIEW_LIMIT = 1;

export const getMetricsFileUrls = (submission) => {
  if (Array.isArray(submission?.metrics_file_urls) && submission.metrics_file_urls.length > 0) {
    return submission.metrics_file_urls.filter(Boolean);
  }
  if (submission?.metrics_file_url) return [submission.metrics_file_url];
  return [];
};

export const getFileNameFromUrl = (url, index) => {
  if (!url) return `Arquivo ${index + 1}`;

  try {
    const pathname = new URL(url).pathname;
    const rawName = decodeURIComponent(pathname.split('/').pop() || '').split('?')[0];
    if (rawName) return rawName;
  } catch {
    // fallback below
  }

  return `Arquivo ${index + 1}`;
};

const getFileKind = (fileName) => {
  const ext = String(fileName).split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return 'image';
  return 'document';
};

function MetricsFileRow({ url, index }) {
  const fileName = getFileNameFromUrl(url, index);
  const kind = getFileKind(fileName);
  const Icon = kind === 'image' ? FileImage : FileText;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-lg transition-all hover:brightness-110 min-w-0"
      style={{
        padding: '8px 10px',
        backgroundColor: 'rgba(var(--ink),0.03)',
        border: '1px solid rgba(var(--ink),0.08)',
      }}
      title={fileName}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${C.blue}18`, color: C.blue }}
      >
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontSize: 12, fontWeight: 600, color: C.cream }}>
          {fileName}
        </p>
      </div>
      <ExternalLink size={13} style={{ color: `${C.cream}35`, flexShrink: 0 }} />
    </a>
  );
}

export default function MetricsFilesList({
  submission,
  previewLimit = PREVIEW_LIMIT,
  className = '',
}) {
  const files = useMemo(() => getMetricsFileUrls(submission), [submission]);
  const [expanded, setExpanded] = useState(false);

  if (files.length === 0) return null;

  const hasMore = files.length > previewLimit;
  const visibleFiles = expanded || !hasMore ? files : files.slice(0, previewLimit);
  const hiddenCount = files.length - previewLimit;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: `${C.cream}50`,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Arquivos de métricas ({files.length})
      </p>

      <div
        className={expanded && files.length > 5 ? 'overflow-y-auto pr-1' : ''}
        style={expanded && files.length > 5 ? { maxHeight: 220 } : undefined}
      >
        <div className="flex flex-col gap-1.5">
          {visibleFiles.map((url, index) => (
            <MetricsFileRow key={`${url}-${index}`} url={url} index={index} />
          ))}
        </div>
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all hover:brightness-110"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: `${C.cream}65`,
            backgroundColor: 'rgba(var(--ink),0.04)',
            border: '1px solid rgba(var(--ink),0.08)',
          }}
        >
          {expanded ? (
            <>
              <ChevronUp size={12} />
              Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown size={12} />
              Mostrar mais {hiddenCount} {hiddenCount === 1 ? 'arquivo' : 'arquivos'}
            </>
          )}
        </button>
      )}
    </div>
  );
}
