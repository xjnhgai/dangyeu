import type { CalculationDataV2 } from './models-v2'

export function group2OrderKey(name: string): string {
  return name.trim().normalize('NFC').toLocaleLowerCase('vi-VN')
}

/** Move a chip to another chip's position; never change names, IDs or rows. */
export function moveGroup2Name(names: readonly string[], source: string, target: string): string[] {
  const sourceIndex = names.findIndex((name) => group2OrderKey(name) === group2OrderKey(source))
  const targetIndex = names.findIndex((name) => group2OrderKey(name) === group2OrderKey(target))
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return [...names]
  const next = [...names]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}

export function orderGroups2(data: CalculationDataV2, names: readonly string[]): CalculationDataV2 {
  const ranks = new Map(names.map((name, index) => [group2OrderKey(name), index]))
  return { ...data, groups1: data.groups1.map((page) => ({
    ...page,
    groups2: [...page.groups2].sort((a, b) => (ranks.get(group2OrderKey(a.name)) ?? names.length) - (ranks.get(group2OrderKey(b.name)) ?? names.length)),
  })) }
}
