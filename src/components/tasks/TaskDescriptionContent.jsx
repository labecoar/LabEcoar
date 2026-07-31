import React from 'react'
import ReactMarkdown from 'react-markdown'
import DOMPurify from 'dompurify'
import { C, heading } from '@/lib/theme'
import {
  isRichTextDescription,
  normalizeRichDescriptionHtml,
  TASK_DESCRIPTION_SANITIZE_OPTIONS,
} from '@/lib/task-description-format'
import './task-description-quill.css'

const markdownComponents = {
  h1: ({ children }) => (
    <h1
      className="break-words"
      style={{
        ...heading,
        fontSize: 20,
        fontWeight: 900,
        color: C.cream,
        marginTop: 16,
        marginBottom: 8,
        letterSpacing: '-0.02em',
        lineHeight: 1.25,
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="break-words"
      style={{
        ...heading,
        fontSize: 17,
        fontWeight: 800,
        color: C.cream,
        marginTop: 14,
        marginBottom: 6,
        letterSpacing: '-0.01em',
        lineHeight: 1.3,
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="break-words"
      style={{
        ...heading,
        fontSize: 14,
        fontWeight: 700,
        color: `${C.cream}DD`,
        marginTop: 12,
        marginBottom: 4,
        lineHeight: 1.35,
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      className="break-words text-justify whitespace-pre-wrap"
      style={{ fontSize: 13, color: `${C.cream}70`, lineHeight: 1.65, margin: '0 0 8px' }}
    >
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul
      className="list-disc pl-5"
      style={{ fontSize: 13, color: `${C.cream}70`, lineHeight: 1.65, margin: '0 0 8px' }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      className="list-decimal pl-5"
      style={{ fontSize: 13, color: `${C.cream}70`, lineHeight: 1.65, margin: '0 0 8px' }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="break-words" style={{ marginBottom: 4 }}>
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong style={{ color: C.cream, fontWeight: 800, fontSize: '1.08em' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ color: `${C.cream}CC`, fontStyle: 'italic' }}>{children}</em>
  ),
}

export function TaskDescriptionContent({ description, className = '' }) {
  if (!description) return null

  if (isRichTextDescription(description)) {
    const sanitized = normalizeRichDescriptionHtml(
      DOMPurify.sanitize(description, TASK_DESCRIPTION_SANITIZE_OPTIONS)
    )

    return (
      <div
        className={`task-description-rich break-words text-justify ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    )
  }

  return (
    <div className={`task-description-markdown ${className}`.trim()}>
      <ReactMarkdown components={markdownComponents}>{description}</ReactMarkdown>
    </div>
  )
}
