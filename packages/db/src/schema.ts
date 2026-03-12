import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  unique,
  integer,
  boolean,
  numeric,
  jsonb,
  real,
} from 'drizzle-orm/pg-core'

export const entityTypeEnum = pgEnum('entity_type', ['monster', 'item', 'rule'])

export const spellStatusEnum = pgEnum('spell_status', ['known', 'prepared'])

export const roleEnum = pgEnum('campaign_role', ['dungeon_master', 'player'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  inviteCode: varchar('invite_code', { length: 16 }).notNull().unique(),
  inviteExpiresAt: timestamp('invite_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const campaignMembers = pgTable(
  'campaign_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (t) => [unique().on(t.campaignId, t.userId)]
)

export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  className: varchar('class_name', { length: 100 }).notNull(),
  subclassName: varchar('subclass_name', { length: 100 }),
  raceName: varchar('race_name', { length: 100 }).notNull(),
  backgroundName: varchar('background_name', { length: 100 }).notNull().default(''),
  level: integer('level').notNull().default(1),
  experiencePoints: integer('experience_points').notNull().default(0),
  str: integer('str').notNull().default(10),
  dex: integer('dex').notNull().default(10),
  con: integer('con').notNull().default(10),
  int: integer('int').notNull().default(10),
  wis: integer('wis').notNull().default(10),
  cha: integer('cha').notNull().default(10),
  maxHp: integer('max_hp').notNull(),
  currentHp: integer('current_hp').notNull(),
  temporaryHp: integer('temporary_hp').notNull().default(0),
  armorClass: integer('armor_class').notNull().default(10),
  initiative: integer('initiative'),
  speed: integer('speed').notNull().default(30),
  skillProficiencies: jsonb('skill_proficiencies')
    .notNull()
    .$type<Record<string, 'none' | 'proficient' | 'expertise'>>(),
  savingThrowProficiencies: jsonb('saving_throw_proficiencies')
    .notNull()
    .$type<Record<string, boolean>>(),
  backstory: text('backstory'),
  portraitUrl: varchar('portrait_url', { length: 500 }),
  traits: jsonb('traits').notNull().$type<string[]>().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ── SRD Tables ────────────────────────────────────────────────────────────────

export const srdSpells = pgTable('srd_spells', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  level: integer('level').notNull(),
  school: varchar('school', { length: 100 }).notNull(),
  concentration: boolean('concentration').notNull().default(false),
  ritual: boolean('ritual').notNull().default(false),
  classes: text('classes').array().notNull().default([]),
  data: jsonb('data').notNull(),
})

export const srdMonsters = pgTable('srd_monsters', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  challengeRating: numeric('challenge_rating', { precision: 6, scale: 3 }).notNull(),
  monsterType: varchar('monster_type', { length: 100 }).notNull(),
  size: varchar('size', { length: 50 }).notNull(),
  data: jsonb('data').notNull(),
})

export const srdEquipment = pgTable('srd_equipment', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  equipmentCategory: varchar('equipment_category', { length: 100 }).notNull(),
  weaponCategory: varchar('weapon_category', { length: 100 }),
  data: jsonb('data').notNull(),
})

export const srdMagicItems = pgTable('srd_magic_items', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  rarity: varchar('rarity', { length: 50 }).notNull(),
  data: jsonb('data').notNull(),
})

export const srdClasses = pgTable('srd_classes', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  data: jsonb('data').notNull(),
})

export const srdRaces = pgTable('srd_races', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  data: jsonb('data').notNull(),
})

export const srdBackgrounds = pgTable('srd_backgrounds', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  data: jsonb('data').notNull(),
})

export const srdConditions = pgTable('srd_conditions', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  data: jsonb('data').notNull(),
})

export const srdSkills = pgTable('srd_skills', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  data: jsonb('data').notNull(),
})

export const srdDamageTypes = pgTable('srd_damage_types', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  data: jsonb('data').notNull(),
})

export const srdMagicSchools = pgTable('srd_magic_schools', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  data: jsonb('data').notNull(),
})

export const srdWeaponProperties = pgTable('srd_weapon_properties', {
  index: varchar('index', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  data: jsonb('data').notNull(),
})

// ── Inventory Tables ───────────────────────────────────────────────────────────

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id')
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),
  srdEquipmentIndex: varchar('srd_equipment_index', { length: 100 }),
  srdMagicItemIndex: varchar('srd_magic_item_index', { length: 100 }),
  customName: varchar('custom_name', { length: 200 }),
  customDescription: text('custom_description'),
  customWeight: real('custom_weight'),
  quantity: integer('quantity').notNull().default(1),
  isEquipped: boolean('is_equipped').notNull().default(false),
  isAttuned: boolean('is_attuned').notNull().default(false),
  notes: text('notes'),
  addedAt: timestamp('added_at').notNull().defaultNow(),
})

export const characterCurrency = pgTable('character_currency', {
  characterId: uuid('character_id')
    .primaryKey()
    .references(() => characters.id, { onDelete: 'cascade' }),
  pp: integer('pp').notNull().default(0),
  gp: integer('gp').notNull().default(0),
  ep: integer('ep').notNull().default(0),
  sp: integer('sp').notNull().default(0),
  cp: integer('cp').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ── Spell Management Tables ────────────────────────────────────────────────────

export const characterSpells = pgTable(
  'character_spells',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    spellIndex: varchar('spell_index', { length: 100 }).notNull(),
    status: spellStatusEnum('status').notNull(),
    addedAt: timestamp('added_at').notNull().defaultNow(),
  },
  (t) => [unique().on(t.characterId, t.spellIndex)]
)

export const spellSlots = pgTable('spell_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id')
    .notNull()
    .unique()
    .references(() => characters.id, { onDelete: 'cascade' }),
  l1Total: integer('l1_total').notNull().default(0),
  l1Used: integer('l1_used').notNull().default(0),
  l2Total: integer('l2_total').notNull().default(0),
  l2Used: integer('l2_used').notNull().default(0),
  l3Total: integer('l3_total').notNull().default(0),
  l3Used: integer('l3_used').notNull().default(0),
  l4Total: integer('l4_total').notNull().default(0),
  l4Used: integer('l4_used').notNull().default(0),
  l5Total: integer('l5_total').notNull().default(0),
  l5Used: integer('l5_used').notNull().default(0),
  l6Total: integer('l6_total').notNull().default(0),
  l6Used: integer('l6_used').notNull().default(0),
  l7Total: integer('l7_total').notNull().default(0),
  l7Used: integer('l7_used').notNull().default(0),
  l8Total: integer('l8_total').notNull().default(0),
  l8Used: integer('l8_used').notNull().default(0),
  l9Total: integer('l9_total').notNull().default(0),
  l9Used: integer('l9_used').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const concentrationTracker = pgTable('concentration_tracker', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id')
    .notNull()
    .unique()
    .references(() => characters.id, { onDelete: 'cascade' }),
  spellIndex: varchar('spell_index', { length: 100 }),
  startedAt: timestamp('started_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ── DM Tools: NPCs, Encounters, Combatants ────────────────────────────────────

export const encounterStatusEnum = pgEnum('encounter_status', ['preparing', 'active', 'completed'])
export const combatantTypeEnum = pgEnum('combatant_type', ['player_character', 'srd_monster', 'custom_monster', 'npc'])

// ── Custom Content Tables ──────────────────────────────────────────────────────

export const customEntities = pgTable('custom_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  entityType: entityTypeEnum('entity_type').notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  baseIndex: varchar('base_index', { length: 100 }),
  data: jsonb('data').notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const npcs = pgTable('npcs', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  monsterIndex: varchar('monster_index', { length: 100 }),
  customEntityId: uuid('custom_entity_id')
    .references(() => customEntities.id, { onDelete: 'set null' }),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const encounters = pgTable('encounters', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  status: encounterStatusEnum('status').notNull().default('preparing'),
  currentTurnIndex: integer('current_turn_index').notNull().default(0),
  round: integer('round').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const combatants = pgTable('combatants', {
  id: uuid('id').primaryKey().defaultRandom(),
  encounterId: uuid('encounter_id')
    .notNull()
    .references(() => encounters.id, { onDelete: 'cascade' }),
  type: combatantTypeEnum('type').notNull(),
  characterId: uuid('character_id')
    .references(() => characters.id, { onDelete: 'set null' }),
  monsterIndex: varchar('monster_index', { length: 100 }),
  customEntityId: uuid('custom_entity_id')
    .references(() => customEntities.id, { onDelete: 'set null' }),
  npcId: uuid('npc_id')
    .references(() => npcs.id, { onDelete: 'set null' }),
  displayName: varchar('display_name', { length: 200 }).notNull(),
  maxHp: integer('max_hp').notNull(),
  currentHp: integer('current_hp').notNull(),
  armorClass: integer('armor_class').notNull(),
  initiative: integer('initiative'),
  isUnconscious: boolean('is_unconscious').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
})

// ── Notes & Session Logs ──────────────────────────────────────────────────────

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  characterId: uuid('character_id')
    .references(() => characters.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull().default(''),
  isRevealed: boolean('is_revealed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const sessionLogs = pgTable(
  'session_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionNumber: integer('session_number').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull().default(''),
    isPinned: boolean('is_pinned').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [unique().on(t.campaignId, t.sessionNumber)]
)

// ── World Setting & Lore Documents ────────────────────────────────────────────

export const loreDocuments = pgTable('lore_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull().default(''),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
