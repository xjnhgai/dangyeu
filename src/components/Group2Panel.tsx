
import { useState, type FormEvent } from 'react'

import type {
  EntityId,
  Group2,
  NameSuggestion,
} from '../core/models'

import './Group2Panel.css'

export interface Group2PanelProps {
  groups: readonly Group2[]
  suggestions: readonly NameSuggestion[]
  selectedGroup2Id: EntityId | null

  onSelectGroup1: () => void
  onSelectGroup2: (group2Id: EntityId) => void
  onAddGroup2: (name: string) => void
  onToggleVisibility: (
    group2Id: EntityId,
    isVisible: boolean,
  ) => void
}

function Group2Panel({
  groups,
  suggestions,
  selectedGroup2Id,
  onSelectGroup1,
  onSelectGroup2,
  onAddGroup2,
  onToggleVisibility,
}: Group2PanelProps) {
  const [draftName, setDraftName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = draftName.trim()

    if (!name) {
      setErrorMessage('Vui lòng nhập tên nhóm.')
      return
    }

    try {
      onAddGroup2(name)
      setDraftName('')
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể tạo nhóm.',
      )
    }
  }

  return (
    <aside className="group2-panel">
      <header className="group2-panel-header">
        <div>
          <p className="group2-eyebrow">CẤP 2</p>
          <h2>Nhóm</h2>
        </div>

        <button
          type="button"
          className="group1-preview-button"
          onClick={onSelectGroup1}
        >
          A4 cấp 1
        </button>
      </header>

      <form
        className="group2-add-form"
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          value={draftName}
          onChange={(event) => {
            setDraftName(event.target.value)
            setErrorMessage('')
          }}
          placeholder="Tên nhóm mới"
          aria-label="Tên nhóm cấp 2"
          maxLength={100}
        />

        <button type="submit">
          Thêm nhóm
        </button>
      </form>

      {errorMessage && (
        <p className="group2-error" role="alert">
          {errorMessage}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="group2-suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => {
                setDraftName(suggestion.name)
                setErrorMessage('')
              }}
            >
              {suggestion.name}
            </button>
          ))}
        </div>
      )}

      <div className="group2-list-heading">
        <span>Nhóm trong ngày</span>
        <span>{groups.length}</span>
      </div>

      {groups.length === 0 ? (
        <p className="group2-empty">
          Chưa có nhóm cấp 2.
        </p>
      ) : (
        <div className="group2-list">
          {groups.map((group) => (
            <div
              key={group.id}
              className={
                group.id === selectedGroup2Id
                  ? 'group2-item group2-item--active'
                  : 'group2-item'
              }
            >
              <button
                type="button"
                className="group2-select-button"
                aria-pressed={group.id === selectedGroup2Id}
                onClick={() => onSelectGroup2(group.id)}
              >
                <span className="group2-item-name">
                  {group.name}
                </span>

                <span className="group2-item-count">
                  {group.settings.length} thiết lập
                </span>
              </button>

              <button
                type="button"
                className={
                  group.isVisibleOnA4
                    ? 'group2-visibility group2-visibility--visible'
                    : 'group2-visibility group2-visibility--hidden'
                }
                aria-label={
                  group.isVisibleOnA4
                    ? `Ẩn nhóm ${group.name} trên A4`
                    : `Hiện nhóm ${group.name} trên A4`
                }
                aria-pressed={group.isVisibleOnA4}
                onClick={() =>
                  onToggleVisibility(
                    group.id,
                    !group.isVisibleOnA4,
                  )
                }
              >
                {group.isVisibleOnA4 ? 'Hiện' : 'Ẩn'}
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

export default Group2Panel
