import { Hono } from 'hono'
import { authRouter } from './routes/auth.js'
import { campaignsRouter } from './routes/campaigns.js'
import { compendiumRouter } from './routes/compendium.js'
import { campaignCharactersRouter, charactersRouter } from './routes/characters.js'
import { inventoryRouter } from './routes/inventory.js'
import { spellsRouter } from './routes/spells.js'
import { customContentRouter } from './routes/custom-content.js'
import { encountersRouter, npcsRouter } from './routes/dm-tools.js'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/api/v1/auth', authRouter)
app.route('/api/v1/campaigns', campaignsRouter)
app.route('/api/v1/campaigns', campaignCharactersRouter)
app.route('/api/v1/campaigns', customContentRouter)
app.route('/api/v1/campaigns', encountersRouter)
app.route('/api/v1/campaigns', npcsRouter)
app.route('/api/v1/characters', charactersRouter)
app.route('/api/v1/characters', inventoryRouter)
app.route('/api/v1/characters', spellsRouter)
app.route('/api/v1/compendium', compendiumRouter)

export default app
