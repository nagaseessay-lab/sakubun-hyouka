import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from '../pages/LoginPage';
import ChangePasswordPage from '../pages/ChangePasswordPage';

// Evaluator pages
import EvaluatorDashboard from '../pages/evaluator/DashboardPage';
import EvaluationPage from '../pages/evaluator/EvaluationPage';
import AvailabilityPage from '../pages/evaluator/AvailabilityPage';
import NotificationsPage from '../pages/evaluator/NotificationsPage';
import EvaluatorGuidePage from '../pages/evaluator/GuidePage';
import EvaluatorTrainingPage from '../pages/evaluator/TrainingPage';

// Leader pages
import LeaderDashboard from '../pages/leader/DashboardPage';
import RoundsPage from '../pages/leader/RoundsPage';
import UploadPage from '../pages/leader/UploadPage';
import RubricPage from '../pages/leader/RubricPage';
import AssignmentPage from '../pages/leader/AssignmentPage';
import AvailabilityOverviewPage from '../pages/leader/AvailabilityOverviewPage';
import ProgressPage from '../pages/leader/ProgressPage';
import ExportPage from '../pages/leader/ExportPage';
import EssayListPage from '../pages/leader/EssayListPage';
import UsersPage from '../pages/leader/UsersPage';
import GuidePage from '../pages/leader/GuidePage';
import TrainingPage from '../pages/leader/TrainingPage';
import DefectiveEssaysPage from '../pages/leader/DefectiveEssaysPage';

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'leader' ? '/leader' : '/evaluator'} replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/change-password', element: <ChangePasswordPage /> },
  {
    path: '/evaluator',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <EvaluatorDashboard /> },
      { path: 'evaluate/:assignmentId', element: <EvaluationPage /> },
      { path: 'availability', element: <AvailabilityPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'training', element: <EvaluatorTrainingPage /> },
      { path: 'guide', element: <EvaluatorGuidePage /> },
    ],
  },
  {
    path: '/leader',
    element: <ProtectedRoute role="leader"><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <LeaderDashboard /> },
      { path: 'rounds', element: <RoundsPage /> },
      { path: 'upload', element: <UploadPage /> },
      { path: 'rubrics', element: <RubricPage /> },
      { path: 'essays', element: <EssayListPage /> },
      { path: 'defective', element: <DefectiveEssaysPage /> },
      { path: 'assignments', element: <AssignmentPage /> },
      { path: 'availability', element: <AvailabilityOverviewPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'export', element: <ExportPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'guide', element: <GuidePage /> },
      { path: 'training', element: <TrainingPage /> },
      // Leader as evaluator (dual role)
      { path: 'my-assignments', element: <EvaluatorDashboard /> },
      { path: 'evaluate/:assignmentId', element: <EvaluationPage /> },
      { path: 'my-availability', element: <AvailabilityPage /> },
      { path: 'my-notifications', element: <NotificationsPage /> },
      { path: 'my-training', element: <EvaluatorTrainingPage /> },
    ],
  },
  { path: '/', element: <ProtectedRoute><RootRedirect /></ProtectedRoute> },
]);
