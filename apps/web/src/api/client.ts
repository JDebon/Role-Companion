const BASE = '/api/v1'

function getToken(): string | null {
  return sessionStorage.getItem('token')
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error ?? 'REQUEST_FAILED') as Error & {
      status: number
      body: unknown
    }
    err.status = res.status
    err.body = body
    throw err
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string
  user: { id: string; email: string; displayName: string }
}

export function register(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResponse> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  })
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

// ── Campaigns ────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string
  name: string
  role: 'dungeon_master' | 'player'
  memberCount: number
}

export interface CampaignDetail {
  id: string
  name: string
  inviteCode: string
  role: 'dungeon_master' | 'player'
}

export interface Member {
  userId: string
  displayName: string
  role: 'dungeon_master' | 'player'
}

export function getCampaigns(): Promise<Campaign[]> {
  return request('/campaigns')
}

export function createCampaign(name: string): Promise<CampaignDetail> {
  return request('/campaigns', { method: 'POST', body: JSON.stringify({ name }) })
}

export function joinCampaign(inviteCode: string): Promise<CampaignDetail> {
  return request('/campaigns/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  })
}

export function getCampaignMembers(id: string): Promise<Member[]> {
  return request(`/campaigns/${id}/members`)
}

export function regenerateInvite(id: string): Promise<{ inviteCode: string }> {
  return request(`/campaigns/${id}/invite/regenerate`, { method: 'POST' })
}

export function removeMember(campaignId: string, userId: string): Promise<void> {
  return request(`/campaigns/${campaignId}/members/${userId}`, { method: 'DELETE' })
}

// ── Characters ────────────────────────────────────────────────────────────────

export type ProficiencyLevel = 'none' | 'proficient' | 'expertise'

export interface CharacterSummary {
  id: string
  name: string
  className: string
  raceName: string
  level: number
  currentHp: number
  maxHp: number
  userId: string
}

export interface AbilityScore {
  score: number
  modifier: number
}

export interface SkillEntry {
  proficiency: ProficiencyLevel
  bonus: number
}

export interface SavingThrowEntry {
  proficient: boolean
  bonus: number
}

export interface CharacterSheet {
  id: string
  campaignId: string
  userId: string
  name: string
  className: string
  subclassName: string | null
  raceName: string
  backgroundName: string
  level: number
  experiencePoints: number
  proficiencyBonus: number
  abilityScores: Record<string, AbilityScore>
  hp: { current: number; max: number; temporary: number }
  armorClass: number
  initiative: number | null
  speed: number
  skills: Record<string, SkillEntry>
  savingThrows: Record<string, SavingThrowEntry>
  traits: string[]
  backstory: string | null
  portraitUrl: string | null
}

export interface CreateCharacterInput {
  name: string
  className: string
  raceName: string
  backgroundName?: string
  level?: number
  str?: number
  dex?: number
  con?: number
  int?: number
  wis?: number
  cha?: number
  maxHp: number
  currentHp: number
  temporaryHp?: number
  armorClass?: number
  speed?: number
  skillProficiencies?: Record<string, ProficiencyLevel>
  savingThrowProficiencies?: Record<string, boolean>
  traits?: string[]
  backstory?: string
}

export function getCampaignCharacters(campaignId: string): Promise<CharacterSummary[]> {
  return request(`/campaigns/${campaignId}/characters`)
}

export function createCharacter(campaignId: string, data: CreateCharacterInput): Promise<CharacterSheet> {
  return request(`/campaigns/${campaignId}/characters`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getCharacter(characterId: string): Promise<CharacterSheet> {
  return request(`/characters/${characterId}`)
}

export function patchCharacter(characterId: string, data: Partial<CreateCharacterInput & { currentHp: number; maxHp: number; temporaryHp: number }>): Promise<CharacterSheet> {
  return request(`/characters/${characterId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteCharacter(characterId: string): Promise<void> {
  return request(`/characters/${characterId}`, { method: 'DELETE' })
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  name: string
  source: 'srd_equipment' | 'srd_magic_item' | 'custom'
  srdIndex: string | null
  quantity: number
  weight: number | null
  isEquipped: boolean
  isAttuned: boolean
  cost: string | null
  notes: string | null
  customDescription?: string
}

export interface Currency {
  pp: number
  gp: number
  ep: number
  sp: number
  cp: number
}

export interface InventoryResponse {
  items: InventoryItem[]
  currency: Currency
  carryWeight: number
  carryCapacity: number
}

export interface AddItemInput {
  srdEquipmentIndex?: string
  srdMagicItemIndex?: string
  customName?: string
  customDescription?: string
  customWeight?: number
  quantity?: number
  notes?: string
}

export interface PatchItemInput {
  quantity?: number
  isEquipped?: boolean
  isAttuned?: boolean
  notes?: string | null
}

export function getInventory(characterId: string): Promise<InventoryResponse> {
  return request(`/characters/${characterId}/inventory`)
}

export function addInventoryItem(characterId: string, data: AddItemInput): Promise<InventoryItem> {
  return request(`/characters/${characterId}/inventory`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchInventoryItem(
  characterId: string,
  itemId: string,
  data: PatchItemInput
): Promise<InventoryItem> {
  return request(`/characters/${characterId}/inventory/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteInventoryItem(characterId: string, itemId: string): Promise<void> {
  return request(`/characters/${characterId}/inventory/${itemId}`, { method: 'DELETE' })
}

export function putCurrency(characterId: string, currency: Currency): Promise<Currency> {
  return request(`/characters/${characterId}/currency`, {
    method: 'PUT',
    body: JSON.stringify(currency),
  })
}

// ── Spells ────────────────────────────────────────────────────────────────────

export interface SpellEntry {
  spellIndex: string
  name: string
  level: number
  school: string
  concentration: boolean
  status: 'known' | 'prepared'
}

export interface SlotLevel {
  total: number
  used: number
}

export interface SpellSlots {
  l1: SlotLevel; l2: SlotLevel; l3: SlotLevel;
  l4: SlotLevel; l5: SlotLevel; l6: SlotLevel;
  l7: SlotLevel; l8: SlotLevel; l9: SlotLevel;
}

export interface ConcentrationInfo {
  spellIndex: string
  name: string
  startedAt: string
}

export interface SpellsResponse {
  spells: SpellEntry[]
  slots: SpellSlots
  concentration: ConcentrationInfo | null
}

export function getSpells(characterId: string): Promise<SpellsResponse> {
  return request(`/characters/${characterId}/spells`)
}

export function addSpell(
  characterId: string,
  spellIndex: string,
  status: 'known' | 'prepared'
): Promise<SpellEntry> {
  return request(`/characters/${characterId}/spells`, {
    method: 'POST',
    body: JSON.stringify({ spellIndex, status }),
  })
}

export function deleteSpell(characterId: string, spellIndex: string): Promise<void> {
  return request(`/characters/${characterId}/spells/${spellIndex}`, { method: 'DELETE' })
}

export function putSpellSlots(
  characterId: string,
  totals: Partial<Record<'l1Total' | 'l2Total' | 'l3Total' | 'l4Total' | 'l5Total' | 'l6Total' | 'l7Total' | 'l8Total' | 'l9Total', number>>
): Promise<SpellSlots> {
  return request(`/characters/${characterId}/spell-slots`, {
    method: 'PUT',
    body: JSON.stringify(totals),
  })
}

export function expendSpellSlot(characterId: string, level: number): Promise<Partial<SpellSlots>> {
  return request(`/characters/${characterId}/spell-slots/expend`, {
    method: 'POST',
    body: JSON.stringify({ level }),
  })
}

export function recoverSpellSlots(characterId: string): Promise<SpellSlots> {
  return request(`/characters/${characterId}/spell-slots/recover`, {
    method: 'POST',
    body: JSON.stringify({ type: 'long' }),
  })
}

export function putConcentration(
  characterId: string,
  spellIndex: string | null
): Promise<ConcentrationInfo | { spellIndex: null; name: null; startedAt: null }> {
  return request(`/characters/${characterId}/concentration`, {
    method: 'PUT',
    body: JSON.stringify({ spellIndex }),
  })
}

// ── Custom Content ────────────────────────────────────────────────────────────

export type EntityType = 'monster' | 'item' | 'rule'

export interface CustomEntitySummary {
  id: string
  entityType: EntityType
  name: string
  baseIndex: string | null
  createdAt: string
}

export interface CustomEntityDetail extends CustomEntitySummary {
  data: Record<string, unknown>
  updatedAt: string
}

export interface CreateCustomEntityInput {
  entityType: EntityType
  name: string
  baseIndex?: string | null
  data: Record<string, unknown>
}

export interface PatchCustomEntityInput {
  name?: string
  data?: Record<string, unknown>
}

export function getCustomContent(campaignId: string, type?: EntityType): Promise<CustomEntitySummary[]> {
  const qs = type ? `?type=${type}` : ''
  return request(`/campaigns/${campaignId}/custom-content${qs}`)
}

export function getCustomEntity(campaignId: string, entityId: string): Promise<CustomEntityDetail> {
  return request(`/campaigns/${campaignId}/custom-content/${entityId}`)
}

export function createCustomEntity(
  campaignId: string,
  data: CreateCustomEntityInput
): Promise<CustomEntitySummary> {
  return request(`/campaigns/${campaignId}/custom-content`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchCustomEntity(
  campaignId: string,
  entityId: string,
  data: PatchCustomEntityInput
): Promise<CustomEntityDetail> {
  return request(`/campaigns/${campaignId}/custom-content/${entityId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteCustomEntity(campaignId: string, entityId: string): Promise<void> {
  return request(`/campaigns/${campaignId}/custom-content/${entityId}`, { method: 'DELETE' })
}

// ── NPCs ──────────────────────────────────────────────────────────────────────

export interface Npc {
  id: string
  name: string
  monsterIndex: string | null
  customEntityId: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export interface CreateNpcInput {
  name: string
  monsterIndex?: string | null
  customEntityId?: string | null
  notes?: string
}

export function getNpcs(campaignId: string): Promise<Npc[]> {
  return request(`/campaigns/${campaignId}/npcs`)
}

export function createNpc(campaignId: string, data: CreateNpcInput): Promise<Npc> {
  return request(`/campaigns/${campaignId}/npcs`, { method: 'POST', body: JSON.stringify(data) })
}

export function patchNpc(campaignId: string, npcId: string, data: Partial<CreateNpcInput>): Promise<Npc> {
  return request(`/campaigns/${campaignId}/npcs/${npcId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteNpc(campaignId: string, npcId: string): Promise<void> {
  return request(`/campaigns/${campaignId}/npcs/${npcId}`, { method: 'DELETE' })
}

// ── Encounters ────────────────────────────────────────────────────────────────

export interface EncounterSummary {
  id: string
  name: string
  status: 'preparing' | 'active' | 'completed'
  round: number
  combatantCount: number
  createdAt: string
}

export type CombatantType = 'player_character' | 'srd_monster' | 'custom_monster' | 'npc'

export interface Combatant {
  id: string
  displayName: string
  type: CombatantType
  monsterIndex: string | null
  characterId: string | null
  customEntityId: string | null
  npcId: string | null
  initiative: number | null
  currentHp: number
  maxHp: number
  armorClass: number
  isUnconscious: boolean
  sortOrder: number
}

export interface EncounterDetail {
  id: string
  name: string
  status: 'preparing' | 'active' | 'completed'
  round: number
  currentTurnIndex: number
  combatants: Combatant[]
}

export function getEncounters(campaignId: string): Promise<EncounterSummary[]> {
  return request(`/campaigns/${campaignId}/encounters`)
}

export function createEncounter(campaignId: string, name: string): Promise<EncounterSummary> {
  return request(`/campaigns/${campaignId}/encounters`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function getEncounter(campaignId: string, encounterId: string): Promise<EncounterDetail> {
  return request(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

export function deleteEncounter(campaignId: string, encounterId: string): Promise<void> {
  return request(`/campaigns/${campaignId}/encounters/${encounterId}`, { method: 'DELETE' })
}

export type AddCombatantInput =
  | { type: 'srd_monster'; monsterIndex: string; count?: number }
  | { type: 'player_character'; characterId: string }
  | { type: 'custom_monster'; customEntityId: string; count?: number }
  | { type: 'npc'; npcId: string }

export function addCombatant(
  campaignId: string,
  encounterId: string,
  data: AddCombatantInput
): Promise<Combatant[]> {
  return request(`/campaigns/${campaignId}/encounters/${encounterId}/combatants`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function startEncounter(
  campaignId: string,
  encounterId: string,
  initiatives: Array<{ combatantId: string; initiative: number }>
): Promise<EncounterDetail> {
  return request(`/campaigns/${campaignId}/encounters/${encounterId}/start`, {
    method: 'POST',
    body: JSON.stringify({ initiatives }),
  })
}

export function applyHpDelta(
  campaignId: string,
  encounterId: string,
  combatantId: string,
  delta: number
): Promise<{ combatantId: string; currentHp: number; isUnconscious: boolean }> {
  return request(`/campaigns/${campaignId}/encounters/${encounterId}/combatants/${combatantId}/hp`, {
    method: 'POST',
    body: JSON.stringify({ delta }),
  })
}

export function nextTurn(
  campaignId: string,
  encounterId: string
): Promise<{ currentTurnIndex: number; round: number; activeCombatant: { id: string; displayName: string } | null }> {
  return request(`/campaigns/${campaignId}/encounters/${encounterId}/next-turn`, { method: 'POST' })
}

export function endEncounter(campaignId: string, encounterId: string): Promise<{ status: string }> {
  return request(`/campaigns/${campaignId}/encounters/${encounterId}/end`, { method: 'POST' })
}

export function resetEncounter(
  campaignId: string,
  encounterId: string
): Promise<{ status: string; round: number }> {
  return request(`/campaigns/${campaignId}/encounters/${encounterId}/reset`, { method: 'POST' })
}
