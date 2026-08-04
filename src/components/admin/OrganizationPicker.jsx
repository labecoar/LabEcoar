// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { Building2, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import { C, heading } from '@/lib/theme'
import { usePageTheme } from '@/hooks/usePageTheme'
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
} from '@/hooks/useOrganizations'
import { notifyError, notifySuccess } from '@/lib/toast'

export default function OrganizationPicker({
  value,
  onChange,
  required = false,
  optionalToggle = false,
  enabled = true,
  onEnabledChange,
}) {
  const {
    textColor, mutedColor, faintColor, labelColor,
    inputStyle, selectStyle, optionStyle, cardBorder, surfaceBgAlt,
  } = usePageTheme()

  const { data: organizations = [], isLoading } = useOrganizations()
  const createOrganization = useCreateOrganization()
  const updateOrganization = useUpdateOrganization()
  const deleteOrganization = useDeleteOrganization()

  const [newName, setNewName] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.id === value) || null,
    [organizations, value]
  )

  const handleCreate = async () => {
    try {
      const created = await createOrganization.mutateAsync(newName)
      onChange?.(created.id)
      setNewName('')
      setShowNewForm(false)
      notifySuccess('Organização criada!')
    } catch (err) {
      notifyError(err?.message || 'Não foi possível criar a organização.')
    }
  }

  const handleUpdate = async (id) => {
    try {
      await updateOrganization.mutateAsync({ id, name: editName })
      setEditingId(null)
      setEditName('')
      notifySuccess('Organização atualizada!')
    } catch (err) {
      notifyError(err?.message || 'Não foi possível atualizar a organização.')
    }
  }

  const handleDelete = async (org) => {
    const confirmed = window.confirm(`Excluir a organização "${org.name}"?`)
    if (!confirmed) return

    try {
      await deleteOrganization.mutateAsync(org.id)
      if (value === org.id) onChange?.('')
      notifySuccess('Organização excluída.')
    } catch (err) {
      notifyError(err?.message || 'Não foi possível excluir a organização.')
    }
  }

  const isVisible = optionalToggle ? enabled : true

  return (
    <div className="rounded-xl p-5 flex flex-col gap-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: surfaceBgAlt }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 size={14} style={{ color: C.orange }} />
          <span style={{ ...heading, fontSize: 13, fontWeight: 700, color: textColor }}>
            Organização (Cliente)
            {required && <span style={{ color: C.orange }}> *</span>}
          </span>
        </div>
        {optionalToggle && (
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              style={{ accentColor: C.lime, width: 16, height: 16 }}
              checked={enabled}
              onChange={(e) => onEnabledChange?.(e.target.checked)}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: mutedColor }}>Relacionar</span>
          </label>
        )}
      </div>

      {isVisible && (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="flex-1 min-w-0 rounded-xl px-3 py-2.5"
              style={selectStyle}
              value={value || ''}
              onChange={(e) => onChange?.(e.target.value)}
              disabled={isLoading}
            >
              <option value="" style={optionStyle}>
                {isLoading ? 'Carregando...' : 'Selecione a organização'}
              </option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id} style={optionStyle}>
                  {org.name}
                </option>
              ))}
            </select>

            {selectedOrg && (
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(selectedOrg.id)
                    setEditName(selectedOrg.name)
                  }}
                  className="h-10 px-3 rounded-xl flex items-center gap-1.5 transition-all hover:brightness-110"
                  style={{ border: `1px solid ${cardBorder}`, color: mutedColor, fontSize: 12, fontWeight: 600, ...heading }}
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedOrg)}
                  className="h-10 px-3 rounded-xl flex items-center gap-1.5 transition-all hover:brightness-110"
                  style={{ border: `1px solid rgba(248,113,113,0.35)`, color: '#f87171', fontSize: 12, fontWeight: 600, ...heading }}
                >
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            )}
          </div>

          {!showNewForm ? (
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              className="self-start flex items-center gap-1.5 transition-opacity hover:opacity-100 opacity-80"
              style={{ fontSize: 12, color: C.lime, fontWeight: 600, ...heading }}
            >
              <Plus size={13} /> Adicionar organização
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="flex-1 rounded-xl px-3 py-2.5"
                style={inputStyle}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da organização (ex: Cuíca, FALA...)"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={createOrganization.isPending}
                  className="h-10 px-3 rounded-xl flex items-center gap-1.5"
                  style={{ backgroundColor: C.lime, color: C.onAccent, fontSize: 12, fontWeight: 700, ...heading }}
                >
                  <Check size={13} /> {createOrganization.isPending ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewForm(false); setNewName('') }}
                  className="h-10 px-3 rounded-xl flex items-center gap-1.5"
                  style={{ border: `1px solid ${cardBorder}`, color: mutedColor, fontSize: 12, fontWeight: 600, ...heading }}
                >
                  <X size={13} /> Cancelar
                </button>
              </div>
            </div>
          )}

          {editingId && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                className="flex-1 rounded-xl px-3 py-2.5"
                style={inputStyle}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Editar nome"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleUpdate(editingId)}
                  disabled={updateOrganization.isPending}
                  className="h-10 px-3 rounded-xl flex items-center gap-1.5"
                  style={{ backgroundColor: C.lime, color: C.onAccent, fontSize: 12, fontWeight: 700, ...heading }}
                >
                  <Check size={13} /> Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setEditName('') }}
                  className="h-10 px-3 rounded-xl flex items-center gap-1.5"
                  style={{ border: `1px solid ${cardBorder}`, color: mutedColor, fontSize: 12, fontWeight: 600, ...heading }}
                >
                  <X size={13} /> Cancelar
                </button>
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, color: faintColor }}>
            Vincule a campanha ao cliente responsável. A ORG será gravada na inscrição e usada no monitoramento e exportação de métricas.
          </p>
        </>
      )}

      {!isVisible && (
        <p style={{ fontSize: 12, color: faintColor }}>
          Marque &quot;Relacionar&quot; para vincular esta tarefa a uma organização.
        </p>
      )}
    </div>
  )
}
