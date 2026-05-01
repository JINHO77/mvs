'use client'

/**
 * IntroRenderer.tsx
 * 경로: src/components/mission/IntroRenderer.tsx
 *
 * intro.text 문자열을 파싱해서 시각적으로 아름답게 렌더링.
 * - 다크/라이트 모드 완벽 지원 (CSS 변수 기반)
 * - Tailwind bg-opacity 오염 차단: 모든 색상은 inline style + CSS 변수 사용
 *
 * 사용법 (page.tsx):
 *   import IntroRenderer from '@/components/mission/IntroRenderer'
 *   <IntroRenderer text={mission.mission_json.intro.text} />
 *
 *   기존 코드 교체 대상:
 *   <p className="mt-3 whitespace-pre-line text-sm leading-6 ...">
 *     {mission.mission_json.intro.text}
 *   </p>
 */

import React from 'react'

interface IntroRendererProps {
  text: string
  subject?: string
}

// ─── 블록 타입 정의 ────────────────────────────────────────────────────────────
type Block =
  | { type: 'divider' }
  | { type: 'section_header'; text: string }
  | { type: 'title_line'; text: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'formula_block'; lines: string[] }
  | { type: 'data_list'; items: { label: string; value: string }[] }
  | { type: 'data_line'; icon: string; text: string }
  | { type: 'callout'; text: string }
  | { type: 'text'; lines: string[] }

// ─── 파서 ──────────────────────────────────────────────────────────────────────
function parseIntroText(raw: string): Block[] {
  const lines = raw.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) { i++; continue }

    // ━━━ 구분선
    if (/^[━─═─]{4,}$/.test(trimmed)) {
      if (blocks[blocks.length - 1]?.type !== 'divider') {
        blocks.push({ type: 'divider' })
      }
      i++; continue
    }

    // [ 섹션 헤더 ]
    if (/^\[.+\]$/.test(trimmed)) {
      blocks.push({ type: 'section_header', text: trimmed.slice(1, -1).trim() })
      i++; continue
    }

    // ASCII 테이블 감지 (┌ ├ └ │ 로 시작)
    if (/^[┌├└│]/.test(trimmed)) {
      const tableLines: string[] = []
      while (i < lines.length) {
        const tl = lines[i].trim()
        if (!tl) { i++; break }
        if (/^[┌├└│┤┬┴┼─┐┘╔╗╚╝╠╣╦╩╬═║━]/.test(tl)) {
          tableLines.push(lines[i])
          i++
        } else {
          break
        }
      }
      if (tableLines.length > 0) {
        const rows = parseTableRows(tableLines)
        if (rows.length > 0) blocks.push({ type: 'table', rows })
      }
      continue
    }

    // 공식 블록 (수식 기호 포함)
    if (
      /[ₙ₁₂₃₄₅₆₇₈₉ᵣ∑Σ∫]/.test(trimmed) ||
      /^aₙ\s*=/.test(trimmed) ||
      /^Sₙ\s*=/.test(trimmed)
    ) {
      const formulaLines: string[] = []
      const startI = i
      while (i < lines.length && i - startI < 8) {
        const fl = lines[i].trim()
        if (!fl || /^[━─═─]{4,}$/.test(fl) || /^\[.+\]$/.test(fl)) break
        formulaLines.push(fl)
        i++
      }
      if (formulaLines.length > 0) blocks.push({ type: 'formula_block', lines: formulaLines })
      continue
    }

    // 데이터 리스트 (• · → ▶ 또는 숫자.)
    if (/^[•·→➡▶]/.test(trimmed) || /^\d+[\.:]/.test(trimmed)) {
      const dataLines: { label: string; value: string }[] = []
      while (i < lines.length) {
        const dl = lines[i].trim()
        if (!dl || /^[━─]{4,}$/.test(dl) || /^\[.+\]$/.test(dl)) break
        if (/^[•·→➡▶]/.test(dl) || /^\d+[\.:]/.test(dl) || /^[①②③④⑤⑥⑦⑧⑨⓪]/.test(dl)) {
          const colonIdx = dl.search(/:\s/)
          if (colonIdx > 0 && colonIdx < 25) {
            dataLines.push({
              label: dl.slice(0, colonIdx).replace(/^[•·→➡▶\d\.\:\s①-⑨⓪]+/, '').trim(),
              value: dl.slice(colonIdx + 1).trim()
            })
          } else {
            dataLines.push({
              label: '',
              value: dl.replace(/^[•·→➡▶\d\.\:\s①-⑨⓪]+/, '').trim()
            })
          }
          i++
        } else break
      }
      if (dataLines.length > 0) blocks.push({ type: 'data_list', items: dataLines })
      continue
    }

    // 이모지 데이터 줄
    const emojiMatch = trimmed.match(/^([\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}])\s+(.+)/u)
    if (emojiMatch) {
      blocks.push({ type: 'data_line', icon: emojiMatch[1], text: emojiMatch[2] })
      i++; continue
    }

    // Callout (★ ☆ 💡 ⭐ ✅ ❗ ❌ ⚠️ 🔑 🎯)
    if (/^[★☆💡⭐✅❗❌⚠️🔑🎯]/.test(trimmed)) {
      blocks.push({ type: 'callout', text: trimmed })
      i++; continue
    }

    // 첫 번째 줄 = 타이틀
    if (blocks.length === 0) {
      blocks.push({ type: 'title_line', text: trimmed })
      i++; continue
    }

    // 일반 텍스트 — 연속 줄 모으기
    const textLines: string[] = []
    while (i < lines.length) {
      const tl = lines[i].trim()
      if (!tl) { i++; break }
      if (/^[━─═─]{4,}$/.test(tl)) break
      if (/^\[.+\]$/.test(tl)) break
      if (/^[┌├└│]/.test(tl)) break
      if (/^[★☆💡⭐✅❗❌⚠️🔑🎯•·→➡▶]/.test(tl)) break
      textLines.push(tl)
      i++
    }
    if (textLines.length > 0) blocks.push({ type: 'text', lines: textLines })
  }

  return blocks
}

function parseTableRows(tableLines: string[]): string[][] {
  const rows: string[][] = []
  for (const line of tableLines) {
    const trimmed = line.trim()
    if (/^[┌┬┐├┼┤└┴┘━─═]+$/.test(trimmed.replace(/[│|]/g, ''))) continue
    if (/^[│|]/.test(trimmed)) {
      const cells = trimmed
        .split(/[│|]/)
        .map(c => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      if (cells.length > 0) rows.push(cells)
    }
  }
  return rows
}

// ─── 서브 컴포넌트들 ────────────────────────────────────────────────────────────

const Divider = () => (
  <div className="my-3 flex items-center gap-2">
    <div
      className="h-px flex-1"
      style={{ background: 'linear-gradient(to right, transparent, var(--accent), transparent)', opacity: 0.25 }}
    />
  </div>
)

const SectionHeader = ({ text }: { text: string }) => (
  <div className="mt-4 mb-2 flex items-center gap-2">
    <span
      className="h-4 w-[3px] flex-shrink-0 rounded-full"
      style={{ background: 'var(--accent)', opacity: 0.85 }}
    />
    <span
      className="text-[10px] font-bold tracking-[0.2em] uppercase"
      style={{ color: 'var(--accent)', opacity: 0.9 }}
    >
      {text}
    </span>
    <span className="h-px flex-1" style={{ background: 'var(--accent)', opacity: 0.18 }} />
  </div>
)

const TitleLine = ({ text }: { text: string }) => (
  <p className="text-sm font-semibold leading-6" style={{ color: 'var(--text)' }}>
    {text}
  </p>
)

/**
 * StyledTable
 *
 * ✅ 핵심 수정:
 *   - 헤더 행: background = var(--accent) 그대로 사용
 *   - 헤더 텍스트: color = var(--bg) — 배경의 반대색이므로 다크/라이트 모두 완벽 대비
 *   - 모든 색상 처리를 inline style로 → Tailwind opacity 문제 완전 차단
 */
const StyledTable = ({ rows }: { rows: string[][] }) => {
  if (rows.length === 0) return null
  const [header, ...body] = rows

  return (
    <div
      className="my-3 overflow-hidden rounded-xl"
      style={{
        border: '1px solid',
        borderColor: 'color-mix(in srgb, var(--accent) 28%, transparent)',
      }}
    >
      {/* ── 헤더 행 ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${header.length}, 1fr)`,
          background: 'var(--accent)',   // 골드(다크) or 핑크(라이트) 그대로
        }}
      >
        {header.map((cell, ci) => (
          <div
            key={ci}
            style={{
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.03em',
              color: 'var(--bg)',          // ← 핵심: --bg가 어두운 배경 = 검정, 밝은 배경 = 흰색
              textAlign: ci === 0 ? 'left' : 'center',
              borderLeft: ci > 0
                ? '1px solid color-mix(in srgb, var(--bg) 20%, transparent)'
                : 'none',
            }}
          >
            {cell}
          </div>
        ))}
      </div>

      {/* ── 바디 행 ── */}
      {body.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${header.length}, 1fr)`,
            background: ri % 2 === 1
              ? 'color-mix(in srgb, var(--accent) 7%, transparent)'
              : 'transparent',
            borderBottom: ri < body.length - 1
              ? '1px solid color-mix(in srgb, var(--accent) 12%, transparent)'
              : 'none',
          }}
        >
          {row.map((cell, ci) => (
            <div
              key={ci}
              style={{
                padding: '7px 12px',
                fontSize: '11px',
                color: 'var(--text)',
                textAlign: ci === 0 ? 'left' : 'center',
                fontWeight: ci === 0 ? 500 : 400,
                borderLeft: ci > 0
                  ? '1px solid color-mix(in srgb, var(--accent) 12%, transparent)'
                  : 'none',
              }}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** 공식 블록 — = 기준으로 좌/우 분리 강조 */
const FormulaBlock = ({ lines }: { lines: string[] }) => (
  <div
    className="my-3 rounded-xl px-4 py-3"
    style={{
      border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
      background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
    }}
  >
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const eqIdx = line.indexOf('=')
        if (eqIdx > 0 && eqIdx < line.length - 1) {
          const left = line.slice(0, eqIdx).trim()
          const right = line.slice(eqIdx + 1).trim()
          return (
            <div key={i} className="flex items-baseline gap-2 font-mono">
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--accent)', minWidth: '80px' }}
              >
                {left}
              </span>
              <span style={{ color: 'var(--accent)', opacity: 0.5, fontSize: '12px' }}>=</span>
              <span style={{ color: 'var(--text)', fontSize: '13px' }}>{right}</span>
            </div>
          )
        }
        return (
          <p
            key={i}
            className="font-mono text-xs leading-5"
            style={{ color: 'var(--text)', opacity: 0.8 }}
          >
            {line}
          </p>
        )
      })}
    </div>
  </div>
)

/** 데이터 리스트 */
const DataList = ({ items }: { items: { label: string; value: string }[] }) => (
  <div className="my-2 space-y-1">
    {items.map((item, i) => (
      <div key={i} className="flex items-start gap-2">
        <span
          className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: 'var(--accent)', opacity: 0.7 }}
        />
        <span className="text-xs leading-5" style={{ color: 'var(--text)' }}>
          {item.label && (
            <span className="font-semibold mr-1" style={{ color: 'var(--accent)' }}>
              {item.label}:
            </span>
          )}
          {item.value}
        </span>
      </div>
    ))}
  </div>
)

/** 이모지 줄 */
const DataLine = ({ icon, text }: { icon: string; text: string }) => (
  <div className="my-1 flex items-start gap-2">
    <span className="text-sm leading-5 flex-shrink-0">{icon}</span>
    <span className="text-xs leading-5" style={{ color: 'var(--text)', opacity: 0.85 }}>
      {text}
    </span>
  </div>
)

/** Callout — accent 테두리 강조 박스 */
const Callout = ({ text }: { text: string }) => (
  <div
    className="my-2 rounded-lg px-3 py-2"
    style={{
      borderLeft: '3px solid var(--accent)',
      background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
      paddingLeft: '12px',
    }}
  >
    <span className="text-xs font-medium leading-5" style={{ color: 'var(--text)' }}>
      {text}
    </span>
  </div>
)

/** 일반 텍스트 */
const TextBlock = ({ lines }: { lines: string[] }) => (
  <div className="my-0.5 space-y-0.5">
    {lines.map((line, i) => (
      <p key={i} className="text-xs leading-6" style={{ color: 'var(--text)', opacity: 0.85 }}>
        {line}
      </p>
    ))}
  </div>
)

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function IntroRenderer({ text }: IntroRendererProps) {
  if (!text) return null
  const blocks = parseIntroText(text)

  return (
    <div className="mt-3 space-y-0.5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'divider':        return <Divider key={i} />
          case 'section_header': return <SectionHeader key={i} text={block.text} />
          case 'title_line':     return <TitleLine key={i} text={block.text} />
          case 'table':          return <StyledTable key={i} rows={block.rows} />
          case 'formula_block':  return <FormulaBlock key={i} lines={block.lines} />
          case 'data_list':      return <DataList key={i} items={block.items} />
          case 'data_line':      return <DataLine key={i} icon={block.icon} text={block.text} />
          case 'callout':        return <Callout key={i} text={block.text} />
          case 'text':           return <TextBlock key={i} lines={block.lines} />
          default:               return null
        }
      })}
    </div>
  )
}
