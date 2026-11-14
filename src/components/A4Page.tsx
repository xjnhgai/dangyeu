
import type {
  A4ProjectionSection,
  A4SettingReference,
} from '../core/a4'

import type {
  A4SectionSummary,
  CalculationTotals,
} from '../core/summary'

import {
  parseListingText,
  type WorkspaceCalculationResult,
} from '../core/workspace-calculator'

import './A4Page.css'

// ============================================================
// 1. NUMBER FORMATTING
// ============================================================

function formatNumber(value: number | null): string {
  if (value === null) {
    return '—'
  }

  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 4,
  }).format(value)
}

// ============================================================
// 2. SETTING CARD
// ============================================================

interface SettingCardProps {
  reference: A4SettingReference
  results: WorkspaceCalculationResult['settingResults']
  showName?: boolean
}

function SettingCard({
  reference,
  results,
  showName = true,
}: SettingCardProps) {
  const { setting } = reference

  const result = results.get(setting.id)

  const listing = parseListingText(setting.listing)

  const matchFlags = result?.listingMatchFlags ?? []

  return (
    <article className="a4-setting-card">
      {showName && (
        <h3 className="a4-setting-title">
          {setting.name}
        </h3>
      )}

      <div className="a4-setting-content">
        <div className="a4-listing">
          {listing.length === 0 ? (
            <span className="a4-empty-value">—</span>
          ) : (
            listing.map((number, index) => (
              <span
                key={`${setting.id}-${index}`}
                className={
                  matchFlags[index]
                    ? 'a4-number a4-number--matched'
                    : 'a4-number'
                }
              >
                {number}
              </span>
            ))
          )}
        </div>

        <div className="a4-point">
          <span className="a4-point-label">Điểm</span>
          <strong>
            {setting.point.trim() || '—'}
          </strong>
        </div>
      </div>
    </article>
  )
}

// ============================================================
// 3. SETTING COLLECTION
// ============================================================

interface SettingCollectionProps {
  settings: readonly A4SettingReference[]
  results: WorkspaceCalculationResult['settingResults']
  showNames?: boolean
}

function SettingCollection({
  settings,
  results,
  showNames = true,
}: SettingCollectionProps) {
  return (
    <div className="a4-settings-grid">
      {settings.map((reference) => (
        <SettingCard
          key={reference.setting.id}
          reference={reference}
          results={results}
          showName={showNames}
        />
      ))}
    </div>
  )
}

// ============================================================
// 4. SUMMARY VALUES
// ============================================================

interface SectionTotalsProps {
  totals: CalculationTotals
}

function SectionTotals({ totals }: SectionTotalsProps) {
  return (
    <div className="a4-group-totals">
      <div>
        <span>Đ</span>
        <strong>{formatNumber(totals.d)}</strong>
      </div>

      <div>
        <span>T</span>
        <strong>{formatNumber(totals.t)}</strong>
      </div>
    </div>
  )
}

function WorkspaceTotals({ totals }: SectionTotalsProps) {
  return (
    <footer className="a4-workspace-totals">
      <div className="a4-total-item">
        <span>Đ</span>
        <strong>{formatNumber(totals.d)}</strong>
      </div>

      <div className="a4-total-item">
        <span>T</span>
        <strong>{formatNumber(totals.t)}</strong>
      </div>

      <div className="a4-total-item">
        <span>T − Đ</span>
        <strong>{formatNumber(totals.difference)}</strong>
      </div>
    </footer>
  )
}

// ============================================================
// 5. A4 SECTION
// ============================================================

interface A4SectionProps {
  section: A4ProjectionSection
  summary: A4SectionSummary
  results: WorkspaceCalculationResult['settingResults']
}

function A4Section({
  section,
  summary,
  results,
}: A4SectionProps) {
  switch (section.kind) {
    case 'group2':
      return (
        <section className="a4-section a4-section--group2">
          <h2 className="a4-group-title">
            {section.title}
          </h2>

          <SettingCollection
            settings={section.settings}
            results={results}
          />

          <SectionTotals totals={summary.totals} />
        </section>
      )

    case 'group1-settings':
      return (
        <section className="a4-section a4-section--flattened">
          <SettingCollection
            settings={section.settings}
            results={results}
          />

          <SectionTotals totals={summary.totals} />
        </section>
      )

    case 'selected-group-settings':
      return (
        <section className="a4-section a4-section--selected">
          <SettingCollection
            settings={section.settings}
            results={results}
          />

          <SectionTotals totals={summary.totals} />
        </section>
      )

    case 'single-setting':
      return (
        <section className="a4-section a4-section--single">
          <SettingCard
            reference={{
              group2Id: section.group2Id,
              setting: section.setting,
            }}
            results={results}
            showName={false}
          />
          <SectionTotals totals={summary.totals} />
        </section>
      )

    default: {
      const exhaustiveCheck: never = section
      return exhaustiveCheck
    }
  }
}

// ============================================================
// 6. A4 PAGE
// ============================================================

export interface A4PageProps {
  result: WorkspaceCalculationResult
}

export default function A4Page({
  result,
}: A4PageProps) {
  const { projection, summary, settingResults } = result

  return (
    <div className="a4-page-wrapper">
      <article
        className={`a4-page a4-page--level-${projection.level}`}
      >
        {projection.title !== null && (
          <header className="a4-page-header">
            <h1>{projection.title}</h1>
          </header>
        )}

        <main className="a4-content-grid">
          {projection.sections.map((section, index) => (
            <A4Section
              key={`${section.kind}-${index}`}
              section={section}
              summary={summary.sections[index]}
              results={settingResults}
            />
          ))}

          {projection.sections.length === 0 && (
            <p className="a4-empty-workspace">
              Chưa có thiết lập.
            </p>
          )}
        </main>

        <WorkspaceTotals totals={summary.totals} />
      </article>
    </div>
  )
}
