import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { CampaignListPage } from './pages/CampaignListPage'
import { CampaignPage } from './pages/CampaignPage'
import { CharacterSheetPage } from './pages/CharacterSheetPage'
import { CustomContentPage } from './pages/CustomContentPage'
import { EncounterListPage } from './pages/EncounterListPage'
import { EncounterRunnerPage } from './pages/EncounterRunnerPage'
import { NpcPage } from './pages/NpcPage'
import { ProtectedRoute } from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/campaigns"
        element={
          <ProtectedRoute>
            <CampaignListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:id"
        element={
          <ProtectedRoute>
            <CampaignPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:id/custom-content"
        element={
          <ProtectedRoute>
            <CustomContentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:id/encounters"
        element={
          <ProtectedRoute>
            <EncounterListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:id/encounters/:encId"
        element={
          <ProtectedRoute>
            <EncounterRunnerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:id/npcs"
        element={
          <ProtectedRoute>
            <NpcPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/characters/:id"
        element={
          <ProtectedRoute>
            <CharacterSheetPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
