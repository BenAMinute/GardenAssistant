import React, { useState } from 'react';
import {
  Sprout,
  LayoutGrid,
  Grid,
  BookOpen,
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  LogOut,
  Cloud,
  HardDrive,
  Info,
  Check,
  Edit3,
  X,
  ChevronDown,
} from 'lucide-react';
import { GardenLayout, UserProfile } from '../types/garden';
import { FIREBASE_CONFIG, isFirebaseConfigured } from '../services/firebase';

export type ActiveTab = 'overview' | 'editor' | 'guide';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  layouts: GardenLayout[];
  currentLayout: GardenLayout;
  onSelectLayout: (layoutId: string) => void;
  onCreateLayout: (name: string) => void;
  onDuplicateLayout: () => void;
  onRenameLayout: (newName: string) => void;
  onDeleteLayout: (layoutId: string) => void;
  user: UserProfile | null;
  onSignIn: () => void;
  onSignOut: () => void;
  activeBedName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  layouts,
  currentLayout,
  onSelectLayout,
  onCreateLayout,
  onDuplicateLayout,
  onRenameLayout,
  onDeleteLayout,
  user,
  onSignIn,
  onSignOut,
  activeBedName,
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(currentLayout.name);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLayoutName.trim()) return;
    onCreateLayout(newLayoutName.trim());
    setNewLayoutName('');
    setShowLayoutMenu(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameValue.trim()) {
      onRenameLayout(renameValue.trim());
    }
    setIsRenaming(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-emerald-900 text-white shadow-sm border-b border-emerald-800">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-12 md:h-16 flex items-center justify-between gap-2">
          {/* Left: Brand Logo + Mobile Layout Pill */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-emerald-700/90 border border-emerald-500/40 flex items-center justify-center shadow-inner shrink-0">
              <Sprout className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" />
            </div>
            <div className="hidden sm:block truncate">
              <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight">
                Garden Assistant
              </h1>
              <p className="text-[11px] text-emerald-200/80 hidden lg:block truncate">
                1 Sq Ft Grid Plotter &amp; Companion Planting Guide
              </p>
            </div>

            {/* Mobile-First Layout Switcher Trigger right next to Logo */}
            <button
              onClick={() => {
                setRenameValue(currentLayout.name);
                setShowLayoutMenu((prev) => !prev);
              }}
              className="flex sm:hidden items-center gap-1.5 bg-emerald-800/90 active:bg-emerald-700 text-emerald-50 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-emerald-600/50 max-w-[190px]"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="truncate">{currentLayout.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            </button>
          </div>

          {/* Desktop Center Navigation */}
          <nav className="hidden md:flex items-center bg-emerald-950/60 p-1 rounded-xl border border-emerald-800/80">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Overall Yard ({currentLayout.beds.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'editor'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span className="max-w-[160px] truncate">
                {activeBedName ? `Edit: ${activeBedName}` : 'Bed Plotter'}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'guide'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Plant Families &amp; Guide</span>
            </button>
          </nav>

          {/* Right Controls: Desktop Layout Switcher + Google Auth */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Desktop/Tablet Layout Switcher Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setRenameValue(currentLayout.name);
                  setShowLayoutMenu((prev) => !prev);
                }}
                className="hidden sm:flex items-center gap-1.5 bg-emerald-800/90 hover:bg-emerald-700 text-emerald-50 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium border border-emerald-600/50 transition"
                title="Switch or Save Garden Layouts"
              >
                <FolderOpen className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="max-w-[150px] truncate">{currentLayout.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              </button>

              {showLayoutMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/30 sm:bg-transparent"
                    onClick={() => setShowLayoutMenu(false)}
                  />
                  <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 sm:w-80 bg-white text-stone-800 rounded-2xl shadow-2xl border border-stone-200 z-50 p-4">
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-stone-100">
                      <div>
                        <h3 className="font-bold text-sm text-stone-900">
                          Saved Garden Layouts
                        </h3>
                        <p className="text-[11px] text-stone-500">
                          Switch between seasonal or experimental plans
                        </p>
                      </div>
                      <button
                        onClick={() => setShowLayoutMenu(false)}
                        className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Current Layout Actions */}
                    <div className="mb-3 bg-emerald-50/70 rounded-xl p-2.5 border border-emerald-200/70">
                      {isRenaming ? (
                        <form
                          onSubmit={handleRenameSubmit}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 block">
                              Active Layout
                            </span>
                            <span className="font-semibold text-xs text-stone-900 truncate block">
                              {currentLayout.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setIsRenaming(true)}
                              className="p-1.5 text-stone-600 hover:text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                              title="Rename Layout"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                onDuplicateLayout();
                                setShowLayoutMenu(false);
                              }}
                              className="p-1.5 text-stone-600 hover:text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                              title="Duplicate Layout"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Layout List */}
                    <div className="space-y-1 max-h-48 overflow-y-auto mb-3 pr-1">
                      {layouts.map((layout) => {
                        const isSelected = layout.id === currentLayout.id;
                        return (
                          <div
                            key={layout.id}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition ${
                              isSelected
                                ? 'bg-emerald-600 text-white font-semibold'
                                : 'hover:bg-stone-100 text-stone-700'
                            }`}
                            onClick={() => {
                              onSelectLayout(layout.id);
                              setShowLayoutMenu(false);
                            }}
                          >
                            <div className="truncate pr-2">
                              <div className="truncate">{layout.name}</div>
                              <div
                                className={`text-[10px] ${
                                  isSelected ? 'text-emerald-100' : 'text-stone-400'
                                }`}
                              >
                                {layout.beds.length} bed
                                {layout.beds.length === 1 ? '' : 's'}
                              </div>
                            </div>
                            {layouts.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteLayout(layout.id);
                                }}
                                className={`p-1.5 rounded-lg hover:bg-red-500/20 ${
                                  isSelected
                                    ? 'text-emerald-100 hover:text-white'
                                    : 'text-stone-400 hover:text-red-600'
                                }`}
                                title="Delete layout"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Create New Layout Form */}
                    <form
                      onSubmit={handleCreate}
                      className="pt-2 border-t border-stone-100 flex gap-1.5"
                    >
                      <input
                        type="text"
                        placeholder="New layout name (e.g. Summer 2027)"
                        value={newLayoutName}
                        onChange={(e) => setNewLayoutName(e.target.value)}
                        className="flex-1 text-xs px-2.5 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create</span>
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>

            {/* Firebase Status Button (Desktop) */}
            <button
              onClick={() => setShowFirebaseModal(true)}
              className="hidden sm:flex p-1.5 rounded-xl bg-emerald-800/70 hover:bg-emerald-700 text-emerald-200 border border-emerald-700/60 transition"
              title="Firebase Cloud Status"
            >
              <Info className="w-4 h-4" />
            </button>

            {/* Google Sign-In / Profile */}
            {user ? (
              <div className="flex items-center gap-1.5 bg-emerald-950/60 pl-2 pr-1 py-1 rounded-xl border border-emerald-700/60">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-6 h-6 rounded-full border border-emerald-400/50"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-700 text-emerald-100 text-[11px] font-bold flex items-center justify-center">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold leading-none truncate max-w-[110px]">
                    {user.displayName}
                  </span>
                  <span className="text-[10px] text-emerald-300 flex items-center justify-end gap-1 mt-0.5">
                    {user.isDemo ? (
                      <>
                        <HardDrive className="w-2.5 h-2.5" /> Local
                      </>
                    ) : (
                      <>
                        <Cloud className="w-2.5 h-2.5" /> Synced
                      </>
                    )}
                  </span>
                </div>
                <button
                  onClick={onSignOut}
                  className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-800 rounded-lg transition"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="flex items-center gap-1.5 bg-white text-stone-800 hover:bg-stone-100 active:scale-95 px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5L1.6 16c1.9 3.9 5.8 7 10.4 7z"
                  />
                </svg>
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex items-center justify-around h-14 px-1.5 select-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 flex flex-col items-center justify-center h-11 rounded-xl text-[11px] font-medium transition active:scale-95 ${
            activeTab === 'overview'
              ? 'text-emerald-800 bg-emerald-100/80 font-bold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <LayoutGrid className="w-5 h-5 mb-0.5" />
          <span>Yard Map ({currentLayout.beds.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex-1 flex flex-col items-center justify-center h-11 rounded-xl text-[11px] font-medium transition active:scale-95 ${
            activeTab === 'editor'
              ? 'text-emerald-800 bg-emerald-100/80 font-bold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Grid className="w-5 h-5 mb-0.5" />
          <span className="truncate max-w-[110px]">
            {activeBedName ? activeBedName.split(' ')[0] + ' Bed' : 'Bed Plotter'}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex-1 flex flex-col items-center justify-center h-11 rounded-xl text-[11px] font-medium transition active:scale-95 ${
            activeTab === 'guide'
              ? 'text-emerald-800 bg-emerald-100/80 font-bold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>Plant Guide</span>
        </button>
      </nav>

      {/* Firebase Info Modal */}
      {showFirebaseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-lg text-stone-900">
                Firebase Cloud Status
              </h3>
              <button
                onClick={() => setShowFirebaseModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-stone-600">
              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  isFirebaseConfigured
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {isFirebaseConfigured ? (
                  <>
                    <Cloud className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-semibold">Firebase Connected</div>
                      <div className="text-xs">
                        Project ID: <code>{FIREBASE_CONFIG.projectId}</code>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-semibold">
                        Running in Local Placeholder Mode
                      </div>
                      <div className="text-xs">
                        All layouts and beds are saved automatically in your browser.
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowFirebaseModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
