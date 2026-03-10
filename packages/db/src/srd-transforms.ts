// Pure transform functions for SRD seeding — no DB dependency.

export type RawEntry = Record<string, unknown>

export function transformSpell(entry: RawEntry) {
  const school = (entry.school as { name?: string } | undefined)?.name ?? ''
  const classes = ((entry.classes as Array<{ name?: string }>) ?? []).map(
    (c) => c.name ?? ''
  )
  return {
    index: entry.index as string,
    name: entry.name as string,
    level: (entry.level as number) ?? 0,
    school,
    concentration: (entry.concentration as boolean) ?? false,
    ritual: (entry.ritual as boolean) ?? false,
    classes,
    data: entry,
  }
}

export function transformMonster(entry: RawEntry) {
  const rawCr = entry.challenge_rating
  const cr =
    rawCr !== undefined && rawCr !== null ? String(rawCr) : '0'
  return {
    index: entry.index as string,
    name: entry.name as string,
    challengeRating: cr,
    monsterType: (entry.type as string) ?? '',
    size: (entry.size as string) ?? '',
    data: entry,
  }
}

export function transformEquipment(entry: RawEntry) {
  const eqCat =
    (entry.equipment_category as { name?: string } | undefined)?.name ?? ''
  const wpCat = (entry.weapon_category as string | undefined) ?? null
  return {
    index: entry.index as string,
    name: entry.name as string,
    equipmentCategory: eqCat,
    weaponCategory: wpCat,
    data: entry,
  }
}

export function transformMagicItem(entry: RawEntry) {
  const rarity =
    (entry.rarity as { name?: string } | undefined)?.name ?? ''
  return {
    index: entry.index as string,
    name: entry.name as string,
    rarity,
    data: entry,
  }
}

export function base(entry: RawEntry) {
  return {
    index: entry.index as string,
    name: entry.name as string,
    data: entry,
  }
}
