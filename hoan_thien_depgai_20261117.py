#!/usr/bin/env python3
"""Minimal, guarded patch for the current dangyeu codebase.

Completes removal of the obsolete XA/XB five-number coefficient profile.
Keeps calculation, saved coefficients, UI structure and parser behavior intact.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parent

# Pairs are verified against the current published source on 2026-11-17.
PATCHES: dict[str, tuple[tuple[str, str], ...]] = {
    'src/App.tsx': (
        ('XA/XB cần 2–5 số, Điểm và đủ hệ số theo số lượng số trong danh sách.',
         'XA/XB cần 2–4 số, Điểm và đủ hệ số theo số lượng số trong danh sách.'),
        ('XA/XB yêu cầu đúng 2, 3, 4 hoặc 5 số trong ô Liệt kê.',
         'XA/XB yêu cầu đúng 2, 3 hoặc 4 số trong ô Liệt kê.'),
    ),
    'src/core/models-v2.ts': (
        ("export type ListingCountKey = '2' | '3' | '4' | '5'",
         "export type ListingCountKey = '2' | '3' | '4'"),
    ),
    'src/core/coefficient-defaults.ts': (
        ("({'2':'10','3':'35','4':'100','5':'1'}[key])",
         "({'2':'10','3':'35','4':'100'}[key])"),
    ),
}

TEST_FILE = 'test/unit/xa-xb-profile-cleanup.test.ts'
TEST_SOURCE = '''import { describe, expect, it } from 'vitest'
import { withCoefficientDefaults } from '../../src/core/coefficient-defaults'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import { getCoefficientProfileKey, getCoefficientProfileKeys } from '../../src/core/workspace-calculator-v2'
import { parseAll } from '../../src/core/all-input'

describe('XA/XB profiles: only two, three, or four numbers', () => {
  it.each(['xa', 'xb'] as const)('has no five-number profile for %s', formula => {
    const type = createCalculationDataV2().settingTypes.find(type => type.formulaId === formula)!
    expect(getCoefficientProfileKeys(formula)).toEqual(['2', '3', '4'])
    expect(Object.keys(type.defaultCoefficientsByCount ?? {})).toEqual(['2', '3', '4'])
    expect(getCoefficientProfileKey(formula, ['01', '02', '03', '04', '05'])).toBeNull()
    expect(type.defaultCoefficientsByCount).toEqual({
      '2': { coefficientD: '0,65', coefficientT: '10' },
      '3': { coefficientD: '0,65', coefficientT: '35' },
      '4': { coefficientD: '0,65', coefficientT: '100' },
    })
  })

  it.each(['xa', 'xb'] as const)('discards obsolete five-number settings without changing other saved settings for %s', formula => {
    const type = createCalculationDataV2().settingTypes.find(type => type.formulaId === formula)!
    const legacy = {
      ...type,
      defaultCoefficientsByCount: {
        ...type.defaultCoefficientsByCount,
        '2': { coefficientD: '2,5', coefficientT: '9' },
        '5': { coefficientD: '888', coefficientT: '999' },
      },
    }
    const actual = withCoefficientDefaults(legacy)
    expect(Object.keys(actual.defaultCoefficientsByCount ?? {})).toEqual(['2', '3', '4'])
    expect(actual.defaultCoefficientsByCount?.['2']).toEqual({ coefficientD: '2,5', coefficientT: '9' })
    expect(actual.defaultCoefficientsByCount?.['4']).toEqual(type.defaultCoefficientsByCount?.['4'])
  })

  it('still accepts four xiên numbers and rejects five without adding result rows', () => {
    const types = createCalculationDataV2().settingTypes
    expect(parseAll('xiên 11.22.33.44.10n', types)).toHaveLength(1)
    expect(() => parseAll('xiên 11.22.33.44.55.10n', types)).toThrow()
  })
})
'''


def main() -> int:
    if not (ROOT / 'package.json').is_file() or not (ROOT / 'src' / 'App.tsx').is_file():
        print('ERROR: Đặt file này vào thư mục gốc của dự án (cùng cấp package.json).')
        return 1

    proposed: dict[str, str] = {}
    changed: list[str] = []
    for rel, replacements in PATCHES.items():
        path = ROOT / rel
        if not path.is_file():
            print(f'ERROR: Không thấy file {rel}. Chưa chỉnh sửa gì.')
            return 1
        with path.open('r', encoding='utf-8', newline='') as stream:
            old_text = stream.read()
        new_text = old_text
        for old, new in replacements:
            old_count = new_text.count(old)
            new_count = new_text.count(new)
            if old_count == 1 and (new_count == 0 or (new in old and new_count == 1)):
                new_text = new_text.replace(old, new, 1)
            elif old_count == 0 and new_count == 1:
                pass  # Already updated. Idempotent.
            else:
                print(f'ERROR: {rel} không khớp phiên bản dự kiến.')
                print(f'  Cụm cũ: {old!r}; số lần xuất hiện={old_count}; cụm mới={new_count}')
                print('Chưa chỉnh sửa gì. Hãy gửi mã nguồn mới nhất để đối chiếu.')
                return 1
        proposed[rel] = new_text
        if new_text != old_text:
            changed.append(rel)

    test_path = ROOT / TEST_FILE
    test_exists = test_path.exists()
    if test_exists and test_path.read_text(encoding='utf-8') != TEST_SOURCE:
        print(f'ERROR: File {TEST_FILE} đã tồn tại với nội dung khác. Chưa chỉnh sửa gì.')
        return 1

    if not changed and test_exists:
        print('OK: Bản vá đã được áp dụng trước đó. Không thay đổi file nào.')
        return 0

    # Back up changed source files outside the repo so `git add .` will not include backups.
    backups = ROOT.parent / (ROOT.name + '_backup_xa_xb_' + datetime.now().strftime('%Y%m%d_%H%M%S'))
    for rel in changed:
        destination = backups / rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, destination)

    try:
        for rel in changed:
            with (ROOT / rel).open('w', encoding='utf-8', newline='') as stream:
                stream.write(proposed[rel])
        if not test_exists:
            test_path.parent.mkdir(parents=True, exist_ok=True)
            test_path.write_text(TEST_SOURCE, encoding='utf-8', newline='')
    except Exception as exc:
        for rel in changed:
            try:
                shutil.copy2(backups / rel, ROOT / rel)
            except OSError:
                pass
        print(f'ERROR: {exc}; đã thử khôi phục các file nguồn từ backup.')
        return 1

    print('OK: Hoàn thiện giới hạn XA/XB chỉ còn 2, 3, 4 số.')
    print('File đã thay đổi:')
    for rel in changed:
        print('  ' + rel)
    if not test_exists:
        print('  ' + TEST_FILE + ' (kiểm thử bổ sung)')
    print('Không sửa công thức tính, giao diện hoặc hệ số đang lưu.')
    if changed:
        print('Backup mã nguồn trước khi sửa:', backups)
    print('Tiếp theo chạy: npm.cmd test; npm.cmd run lint; npm.cmd run build')
    return 0

if __name__ == '__main__':
    sys.exit(main())
