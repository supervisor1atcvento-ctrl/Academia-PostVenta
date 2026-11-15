import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPanelView from './components/AdminPanelView';
import AdvisorModal from './components/AdvisorModal';
import CatalogView from './components/CatalogView';
import HomeView from './components/HomeView';
import MotoRunnerGame from './components/MotoRunnerGame';
import Navbar from './components/Navbar';
import TrainingQuizView from './components/TrainingQuizView';
import WarrantyGuideView from './components/WarrantyGuideView';
import {
  INITIAL_ADMIN_QUIZ_ITEMS,
  INITIAL_MOTORCYCLES,
  INITIAL_POLICIES,
  INITIAL_SPEC_FIELDS,
  INITIAL_TIME_GUIDES,
} from './data/seedData';
import {
  deleteSheetItem,
  fetchAllData,
  submitGameHighScore,
  submitQuizCompletion,
  syncSeedBatch,
  upsertSheetItem,
} from './services/sheetsApi';
import type {
  AdminQuizItem,
  AdvisorProfile,
  AppTab,
  LocalUser,
  Motorcycle,
  QuizTopic,
  SpecFieldConfig,
  TimeGuideEntry,
  WarrantyPolicy,
} from './types';

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'ivan.moreno@vento.com').toLowerCase();

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [user, setUser] = useState<LocalUser | null>(() => {
    const saved = localStorage.getItem('vp_academy_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [cloudMotorcycles, setCloudMotorcycles] = useState<Motorcycle[]>([]);
  const [cloudPolicies, setCloudPolicies] = useState<WarrantyPolicy[]>([]);
  const [cloudTimeGuides, setCloudTimeGuides] = useState<TimeGuideEntry[]>([]);
  const [cloudSpecFields, setCloudSpecFields] = useState<SpecFieldConfig[]>([]);
  const [cloudQuizQuestions, setCloudQuizQuestions] = useState<AdminQuizItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<AdvisorProfile[]>([]);

  const loadDataFromSheets = useCallback(async () => {
    setIsSyncing(true);
    try {
      const data = await fetchAllData();
      setCloudMotorcycles(data.motorcycles || []);
      setCloudPolicies(data.policies || []);
      setCloudTimeGuides(data.timeGuides || []);
      setCloudSpecFields(data.specFields || []);
      setCloudQuizQuestions(data.quizQuestions || []);
      setLeaderboard(data.advisors || []);
    } catch (err) {
      console.error('Error cargando desde Google Sheets:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadDataFromSheets();
  }, [loadDataFromSheets]);

  const advisorProfile = useMemo(() => {
    if (!user) return null;
    return leaderboard.find((a) => a.uid === user.uid || a.email === user.email) ?? null;
  }, [leaderboard, user]);

  const isAdmin = Boolean(
    user && (user.email.toLowerCase() === ADMIN_EMAIL || advisorProfile?.role === 'admin')
  );

  const isCloudSeeded =
    cloudMotorcycles.length > 0 || cloudPolicies.length > 0 || cloudTimeGuides.length > 0;

  const motorcycles = useMemo(
    () => (cloudMotorcycles.length > 0 ? cloudMotorcycles.filter((m) => m.isActive) : INITIAL_MOTORCYCLES),
    [cloudMotorcycles]
  );

  const policies = useMemo(
    () => (cloudPolicies.length > 0 ? cloudPolicies.filter((p) => p.isActive) : INITIAL_POLICIES),
    [cloudPolicies]
  );

  const timeGuides = useMemo(
    () => (cloudTimeGuides.length > 0 ? cloudTimeGuides.filter((g) => g.isActive) : INITIAL_TIME_GUIDES),
    [cloudTimeGuides]
  );

  const specFields = useMemo(() => {
    const base = cloudSpecFields.length > 0 ? cloudSpecFields : INITIAL_SPEC_FIELDS;
    return [...base].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }, [cloudSpecFields]);

  const adminQuizItems = useMemo(
    () => (cloudQuizQuestions.length > 0 ? cloudQuizQuestions.filter((q) => q.isActive) : INITIAL_ADMIN_QUIZ_ITEMS),
    [cloudQuizQuestions]
  );

  const handleSignIn = async (email: string, displayName: string, branch: string) => {
    const uid = email.toLowerCase();
    const newUser: LocalUser = { uid, email: uid, displayName };
    localStorage.setItem('vp_academy_user', JSON.stringify(newUser));
    setUser(newUser);

    const existing = leaderboard.find((a) => a.uid === uid);
    if (!existing) {
      await upsertSheetItem('advisors', {
        uid,
        email: uid,
        displayName,
        branch,
        role: uid === ADMIN_EMAIL ? 'admin' : 'advisor',
        quizPoints: 0,
        gameHighScore: 0,
        totalPoints: 0,
        quizzesCompleted: 0,
        correctAnswers: 0,
        streakBest: 0,
        updatedAt: new Date().toISOString(),
      });
      await loadDataFromSheets();
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('vp_academy_user');
    setUser(null);
    setProfileModalOpen(false);
  };

  const handleSaveAdvisorProfile = async (displayName: string, branch: string) => {
    if (!user) return;
    const existing = advisorProfile;
    await upsertSheetItem('advisors', {
      uid: user.uid,
      email: user.email,
      displayName,
      branch,
      role: existing?.role || (user.email === ADMIN_EMAIL ? 'admin' : 'advisor'),
      quizPoints: existing?.quizPoints || 0,
      gameHighScore: existing?.gameHighScore || 0,
      totalPoints: existing?.totalPoints || 0,
      quizzesCompleted: existing?.quizzesCompleted || 0,
      correctAnswers: existing?.correctAnswers || 0,
      streakBest: existing?.streakBest || 0,
      updatedAt: new Date().toISOString(),
    });
    await loadDataFromSheets();
  };

  const handleCompleteQuiz = async (result: {
    topic: QuizTopic;
    score: number;
    correctCount: number;
    totalQuestions: number;
    maxStreak: number;
  }) => {
    if (!user) return;
    await submitQuizCompletion({
      advisorUid: user.uid,
      advisorName: advisorProfile?.displayName || user.displayName,
      ...result,
    });
    await loadDataFromSheets();
  };

  const handleSaveGameHighScore = async (newScore: number) => {
    if (!user) return;
    await submitGameHighScore({
      advisorUid: user.uid,
      advisorName: advisorProfile?.displayName || user.displayName,
      newScore,
    });
    await loadDataFromSheets();
  };

  const handleSyncSeedToCloud = async () => {
    await syncSeedBatch({
      motorcycles: INITIAL_MOTORCYCLES,
      warrantyPolicies: INITIAL_POLICIES,
      timeGuides: INITIAL_TIME_GUIDES,
      specFields: INITIAL_SPEC_FIELDS,
      quizQuestions: INITIAL_ADMIN_QUIZ_ITEMS,
    });
    await loadDataFromSheets();
  };

  const handleSaveMotorcycle = async (moto: Motorcycle) => {
    await upsertSheetItem('motorcycles', moto);
    await loadDataFromSheets();
  };

  const handleDeleteMotorcycle = async (id: string) => {
    await deleteSheetItem('motorcycles', id);
    await loadDataFromSheets();
  };

  const handleSavePolicy = async (policy: WarrantyPolicy) => {
    await upsertSheetItem('warrantyPolicies', policy);
    await loadDataFromSheets();
  };

  const handleDeletePolicy = async (id: string) => {
    await deleteSheetItem('warrantyPolicies', id);
    await loadDataFromSheets();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] text-[#231F20]">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        advisorProfile={advisorProfile}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        onRefreshData={loadDataFromSheets}
        isSyncing={isSyncing}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'home' && (
          <HomeView
            user={user}
            advisorProfile={advisorProfile}
            leaderboard={leaderboard}
            isConnected={isCloudSeeded}
            motorcycleCount={motorcycles.length}
            policyCount={policies.length + timeGuides.length}
            onNavigate={setActiveTab}
            onOpenProfile={() => setProfileModalOpen(true)}
          />
        )}
        {activeTab === 'catalog' && (
          <CatalogView
            motorcycles={motorcycles}
            specFields={specFields}
            onStartTrainingForTopic={() => setActiveTab('training')}
          />
        )}
        {activeTab === 'warranty' && (
          <WarrantyGuideView policies={policies} timeGuides={timeGuides} />
        )}
        {activeTab === 'training' && (
          <TrainingQuizView
            motorcycles={motorcycles}
            timeGuides={timeGuides}
            adminQuizItems={adminQuizItems}
            user={user}
            advisorProfile={advisorProfile}
            leaderboard={leaderboard}
            onOpenProfileModal={() => setProfileModalOpen(true)}
            onCompleteQuiz={handleCompleteQuiz}
          />
        )}
        {activeTab === 'runner' && (
          <MotoRunnerGame
            motorcycles={motorcycles}
            timeGuides={timeGuides}
            adminQuizItems={adminQuizItems}
            user={user}
            advisorProfile={advisorProfile}
            leaderboard={leaderboard}
            onOpenProfileModal={() => setProfileModalOpen(true)}
            onSaveGameHighScore={handleSaveGameHighScore}
          />
        )}
        {activeTab === 'admin' && (
          <AdminPanelView
            user={user}
            isAdmin={isAdmin}
            onOpenProfileModal={() => setProfileModalOpen(true)}
            motorcycles={motorcycles}
            policies={policies}
            timeGuides={timeGuides}
            specFields={specFields}
            adminQuizItems={adminQuizItems}
            isCloudSeeded={isCloudSeeded}
            onSyncSeedToCloud={handleSyncSeedToCloud}
            onSaveMotorcycle={handleSaveMotorcycle}
            onDeleteMotorcycle={handleDeleteMotorcycle}
            onSavePolicy={handleSavePolicy}
            onDeletePolicy={handleDeletePolicy}
          />
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white py-5 text-xs text-zinc-500">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Vento &amp; Pistón Academy · Aprende, juega y crece en equipo</span>
          <span>Atención VENTO WA 56 1414 1172 · ayuda.vento.com · Pistón 55 5029 6960</span>
        </div>
      </footer>

      <AdvisorModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        advisorProfile={advisorProfile}
        isAdmin={isAdmin}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onSaveProfile={handleSaveAdvisorProfile}
      />
    </div>
  );
}
