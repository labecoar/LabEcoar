import React, { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import './task-description-quill.css'
import { C } from '@/lib/theme'

const EDITOR_FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'color',
  'background',
  'list',
]

const TOOLBAR_CONFIG = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline'],
  [{ color: [] }, { background: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['clean'],
]

const TOOLBAR_TITLES = {
  bold: 'Negrito',
  italic: 'Itálico',
  underline: 'Sublinhado',
  color: 'Cor da letra',
  background: 'Cor de fundo na palavra',
  clean: 'Limpar formatação',
  headerPicker: 'Estilo de título (H1, H2, H3)',
  header1: 'Título H1 — seção principal',
  header2: 'Título H2 — subtítulo',
  header3: 'Título H3 — subseção',
  headerNormal: 'Texto normal (sem título)',
  listOrdered: 'Lista numerada',
  listBullet: 'Lista com marcadores',
}

const EMPTY_EDITOR_HTML = '<p><br></p>'

function isEmptyEditorHtml(html) {
  const value = String(html || '').trim()
  return !value || value === EMPTY_EDITOR_HTML
}

function applyQuillToolbarTitles(root) {
  if (!root) return

  const setTitle = (selector, title) => {
    root.querySelectorAll(selector).forEach((element) => {
      if (element.title !== title) element.title = title
    })
  }

  setTitle('button.ql-bold', TOOLBAR_TITLES.bold)
  setTitle('button.ql-italic', TOOLBAR_TITLES.italic)
  setTitle('button.ql-underline', TOOLBAR_TITLES.underline)
  setTitle('.ql-color .ql-picker-label', TOOLBAR_TITLES.color)
  setTitle('.ql-background .ql-picker-label', TOOLBAR_TITLES.background)
  setTitle('button.ql-clean', TOOLBAR_TITLES.clean)

  root.querySelectorAll('button.ql-list').forEach((button) => {
    const listValue = button.getAttribute('value')
    const title = listValue === 'ordered'
      ? TOOLBAR_TITLES.listOrdered
      : TOOLBAR_TITLES.listBullet
    if (button.title !== title) button.title = title
  })

  const headerPicker = root.querySelector('.ql-header')
  if (!headerPicker) return

  const label = headerPicker.querySelector('.ql-picker-label')
  if (label && label.title !== TOOLBAR_TITLES.headerPicker) {
    label.title = TOOLBAR_TITLES.headerPicker
  }

  headerPicker.querySelectorAll('.ql-picker-item').forEach((item) => {
    const itemValue = item.getAttribute('data-value')
    let title = TOOLBAR_TITLES.headerNormal
    if (itemValue === '1') title = TOOLBAR_TITLES.header1
    else if (itemValue === '2') title = TOOLBAR_TITLES.header2
    else if (itemValue === '3') title = TOOLBAR_TITLES.header3
    if (item.title !== title) item.title = title
  })
}

export function TaskDescriptionEditor({
  value,
  onChange,
  placeholder = 'Descreva a tarefa em detalhes...',
}) {
  const wrapperRef = useRef(null)
  const editorHostRef = useRef(null)
  const quillRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const skipExternalSyncRef = useRef(false)

  onChangeRef.current = onChange

  useEffect(() => {
    const host = editorHostRef.current
    if (!host || quillRef.current) return

    const quill = new Quill(host, {
      theme: 'snow',
      placeholder,
      modules: { toolbar: TOOLBAR_CONFIG },
      formats: EDITOR_FORMATS,
    })

    quillRef.current = quill

    if (value) {
      const delta = quill.clipboard.convert(value)
      quill.setContents(delta, 'silent')
    }

    const handleTextChange = () => {
      skipExternalSyncRef.current = true
      const html = quill.root.innerHTML
      const plain = quill.getText().trim()
      onChangeRef.current(plain ? html : '')
    }

    quill.on('text-change', handleTextChange)

    const root = wrapperRef.current
    let toolbar = null
    const applyTitles = () => applyQuillToolbarTitles(root)

    const timeoutId = window.setTimeout(() => {
      applyTitles()
      toolbar = root?.querySelector('.ql-toolbar') ?? null
      toolbar?.addEventListener('click', applyTitles, { passive: true })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      toolbar?.removeEventListener('click', applyTitles)
      quill.off('text-change', handleTextChange)
      quillRef.current = null
      host.innerHTML = ''
    }
  }, [placeholder])

  useEffect(() => {
    const quill = quillRef.current
    if (!quill) return

    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false
      return
    }

    const currentHtml = quill.root.innerHTML
    const nextValue = value || ''
    const currentIsEmpty = isEmptyEditorHtml(currentHtml)
    const nextIsEmpty = !nextValue

    if (currentIsEmpty && nextIsEmpty) return
    if (currentHtml === nextValue) return

    if (nextIsEmpty) {
      quill.setContents([], 'silent')
      return
    }

    const delta = quill.clipboard.convert(nextValue)
    quill.setContents(delta, 'silent')
  }, [value])

  return (
    <div
      ref={wrapperRef}
      className="task-description-editor"
      style={{
        '--task-editor-bg': C.black_light,
        '--task-editor-fg': C.cream,
      }}
    >
      <div ref={editorHostRef} />
    </div>
  )
}
