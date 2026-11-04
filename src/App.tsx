import { Route, Routes } from 'react-router';
import { RequireRole } from './auth/RequireRole';
import { AppLayout, PublicLayout } from './components/Layout';
import { AccountPage } from './pages/AccountPage';
import { AdminAssignmentsPage, AdminExportPage, AdminUsersPage } from './pages/admin/AdminPages';
import { NotFoundPage } from './pages/ErrorPages';
import { PatientDevicesPage, PatientProgressPage, PatientSessionPage, PatientSessionsPage } from './pages/patient/PatientPages';
import {
  PatientNotesTab,
  PatientPlanTab,
  PatientSessionsTab,
  PatientSessionTab,
  PatientSummaryTab,
  ProfessionalPatientDetail,
  ProfessionalPatientsPage,
} from './pages/professional/ProfessionalPages';
import { HomePage } from './pages/public/HomePage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="registro" element={<RegisterPage />} />
        <Route path="iniciar-sesion" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        path="cuenta"
        element={
          <RequireRole roles={['patient', 'professional', 'admin']}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route index element={<AccountPage />} />
      </Route>

      <Route
        path="paciente"
        element={
          <RequireRole roles={['patient']}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route index element={<PatientProgressPage />} />
        <Route path="sesiones" element={<PatientSessionsPage />} />
        <Route path="sesiones/:sessionId" element={<PatientSessionPage />} />
        <Route path="visor" element={<PatientDevicesPage />} />
      </Route>

      <Route
        path="profesional"
        element={
          <RequireRole roles={['professional']}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route element={<ProfessionalPatientsPage />}>
          <Route index element={null} />
          <Route path="pacientes/:patientId" element={<ProfessionalPatientDetail />}>
            <Route index element={<PatientSummaryTab />} />
            <Route path="sesiones" element={<PatientSessionsTab />} />
            <Route path="sesiones/:sessionId" element={<PatientSessionTab />} />
            <Route path="notas" element={<PatientNotesTab />} />
            <Route path="plan" element={<PatientPlanTab />} />
          </Route>
        </Route>
      </Route>

      <Route
        path="admin"
        element={
          <RequireRole roles={['admin']}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route index element={<AdminUsersPage />} />
        <Route path="asignaciones" element={<AdminAssignmentsPage />} />
        <Route path="exportacion" element={<AdminExportPage />} />
      </Route>
    </Routes>
  );
}
