export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type ProficiencyLevel = 'none' | 'proficient' | 'expertise'

export const SKILLS: Record<string, Ability> = {
  acrobatics: 'dex',
  animal_handling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleight_of_hand: 'dex',
  stealth: 'dex',
  survival: 'wis',
}

export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1
}

type CharForSkill = {
  level: number
  skillProficiencies: Record<string, ProficiencyLevel>
  str: number; dex: number; con: number
  int: number; wis: number; cha: number
}

export function skillBonus(skill: string, char: CharForSkill): number {
  const ability = SKILLS[skill]
  const mod = abilityMod(char[ability])
  const prof = char.skillProficiencies[skill] ?? 'none'
  const pb = proficiencyBonus(char.level)
  if (prof === 'expertise') return mod + pb * 2
  if (prof === 'proficient') return mod + pb
  return mod
}

export function savingThrowBonus(ability: Ability, char: CharForSkill & { savingThrowProficiencies: Record<string, boolean> }): number {
  const mod = abilityMod(char[ability])
  return char.savingThrowProficiencies[ability] ? mod + proficiencyBonus(char.level) : mod
}

export function defaultSkillProficiencies(): Record<string, ProficiencyLevel> {
  return Object.fromEntries(Object.keys(SKILLS).map((s) => [s, 'none']))
}

export function defaultSavingThrowProficiencies(): Record<string, boolean> {
  return Object.fromEntries(ABILITIES.map((a) => [a, false]))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildFullSheet(char: any) {
  const pb = proficiencyBonus(char.level)

  const abilityScores: Record<string, { score: number; modifier: number }> = {}
  for (const ability of ABILITIES) {
    abilityScores[ability] = { score: char[ability], modifier: abilityMod(char[ability]) }
  }

  const skills: Record<string, { proficiency: ProficiencyLevel; bonus: number }> = {}
  for (const skill of Object.keys(SKILLS)) {
    skills[skill] = {
      proficiency: char.skillProficiencies[skill] ?? 'none',
      bonus: skillBonus(skill, char),
    }
  }

  const savingThrows: Record<string, { proficient: boolean; bonus: number }> = {}
  for (const ability of ABILITIES) {
    savingThrows[ability] = {
      proficient: char.savingThrowProficiencies[ability] ?? false,
      bonus: savingThrowBonus(ability, char),
    }
  }

  return {
    id: char.id,
    campaignId: char.campaignId,
    userId: char.userId,
    name: char.name,
    className: char.className,
    subclassName: char.subclassName ?? null,
    raceName: char.raceName,
    backgroundName: char.backgroundName,
    level: char.level,
    experiencePoints: char.experiencePoints,
    proficiencyBonus: pb,
    abilityScores,
    hp: { current: char.currentHp, max: char.maxHp, temporary: char.temporaryHp },
    armorClass: char.armorClass,
    initiative: char.initiative ?? null,
    speed: char.speed,
    skills,
    savingThrows,
    traits: char.traits ?? [],
    conditions: char.conditions ?? [],
    backstory: char.backstory ?? null,
    status: char.status,
    portraitUrl: char.portraitUrl ?? null,
    createdAt: char.createdAt,
    updatedAt: char.updatedAt,
  }
}
