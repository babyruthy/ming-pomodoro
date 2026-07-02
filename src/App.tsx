import { useState, useEffect, useRef, useCallback } from 'react';
import { SessionType, Settings, Task, Statistics, Quote } from './types';
import { getRandomQuote } from './data/quotes';
import { playSynthAlert, startAmbientSound, stopAmbientSound } from './utils/audio';
import TaskSidebar from './components/TaskSidebar';
import StatisticsDashboard from './components/StatisticsDashboard';
import CanvasConfetti from './components/CanvasConfetti';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  PhoneOff,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Keyboard,
  Flame,
  Award,
  CloudRain,
  Trees,
  Coffee,
  Radio,
  Timer,
  Clock,
  X,
  BarChart
} from 'lucide-react';

const DEFAULT_SETTINGS: Settings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  autoStartNextSession: true,
  notificationSound: true,
  browserNotifications: true,
  dailyGoal: 4,
};

const DEFAULT_STATS: Statistics = {
  todayCompletedCount: 0,
  totalCompletedCount: 0,
  totalFocusTime: 0,
  longestStreak: 0,
  phoneUsageCount: 0,
  averageFocusDuration: 25,
  history: [],
};

export default function App() {
  // --- 1. State Initialization (Sync with LocalStorage) ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('pomodoro_theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('pomodoro_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('pomodoro_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  const [stats, setStats] = useState<Statistics>(() => {
    const saved = localStorage.getItem('pomodoro_stats');
    return saved ? JSON.parse(saved) : DEFAULT_STATS;
  });

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>('focus');
  const [currentCycle, setCurrentCycle] = useState(1); // 1 to 4 focus sessions in a cycle
  
  // Timer numerical states (seconds remaining)
  const [timeLeft, setTimeLeft] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [totalDurationInSeconds, setTotalDurationInSeconds] = useState(settings.focusDuration * 60);

  // Phone usage counter inside CURRENT session
  const [phoneUsageInSession, setPhoneUsageInSession] = useState(0);
  const [showPhoneAnim, setShowPhoneAnim] = useState(false);

  // Sound and visual features
  const [ambientSound, setAmbientSound] = useState<'none' | 'rain' | 'forest' | 'whiteNoise' | 'cafe'>('none');
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfettiActive, setIsConfettiActive] = useState(false);
  const [activeQuote, setActiveQuote] = useState<Quote>(() => getRandomQuote('focus'));
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // References for notification permission and background ticking
  const intervalRef = useRef<any>(null);
  const lastActiveDayRef = useRef<string>(new Date().toDateString());

  // --- 2. Side Effects ---

  // Check and apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('pomodoro_theme', theme);
  }, [theme]);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('pomodoro_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('pomodoro_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('pomodoro_stats', JSON.stringify(stats));
  }, [stats]);

  // Request browser notification permissions on mount
  useEffect(() => {
    if (settings.browserNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [settings.browserNotifications]);

  // Refresh default durations when settings update (only if not running)
  useEffect(() => {
    if (!isRunning) {
      const duration = 
        sessionType === 'focus' ? settings.focusDuration :
        sessionType === 'shortBreak' ? settings.shortBreakDuration :
        settings.longBreakDuration;
      
      setTimeLeft(duration * 60);
      setTotalDurationInSeconds(duration * 60);
    }
  }, [settings, sessionType, isRunning]);

  // Multi-day tracker: Reset "Today's completed count" if calendar day changes
  useEffect(() => {
    const checkDayShift = () => {
      const todayStr = new Date().toDateString();
      if (todayStr !== lastActiveDayRef.current) {
        lastActiveDayRef.current = todayStr;
        setStats(prev => ({
          ...prev,
          todayCompletedCount: 0
        }));
      }
    };
    checkDayShift();
    const interval = setInterval(checkDayShift, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Show desktop notification helper
  const sendBrowserNotification = useCallback((title: string, body: string) => {
    if (settings.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          silent: isMuted || !settings.notificationSound
        });
      } catch (e) {
        console.warn('Notification failed:', e);
      }
    }
  }, [settings.browserNotifications, isMuted, settings.notificationSound]);

  // --- 3. Timer State Machine Logic ---

  const handleNextSession = useCallback((manualSkip = false) => {
    let nextType: SessionType = 'focus';
    let nextCycleCount = currentCycle;

    if (sessionType === 'focus') {
      // Completed Focus Session!
      if (!manualSkip) {
        // Log statistical history item
        const completedMinutes = Math.round((totalDurationInSeconds - timeLeft) / 60) || 1;
        const now = Date.now();
        const historyItem = {
          id: now.toString(),
          timestamp: now,
          type: 'focus' as SessionType,
          duration: completedMinutes,
          phoneUsageCount: phoneUsageInSession,
          completed: true,
        };

        const updatedHistory = [historyItem, ...stats.history];
        
        // Calculate Streak
        const newTodayCount = stats.todayCompletedCount + 1;
        const newTotalCount = stats.totalCompletedCount + 1;
        const newTotalFocusTime = stats.totalFocusTime + completedMinutes;
        const newPhoneCount = stats.phoneUsageCount + phoneUsageInSession;

        let currentStreak = stats.longestStreak;
        let runningStreak = 0;
        let tempStreak = 0;
        
        updatedHistory.forEach(h => {
          if (h.completed && h.type === 'focus') {
            tempStreak++;
          } else {
            if (tempStreak > runningStreak) runningStreak = tempStreak;
            tempStreak = 0;
          }
        });
        const finalStreak = Math.max(currentStreak, tempStreak, runningStreak);

        if (activeTaskId) {
          setTasks(prevTasks =>
            prevTasks.map(t =>
              t.id === activeTaskId
                ? { ...t, completedPomodoros: t.completedPomodoros + 1 }
                : t
            )
          );
        }

        setStats(prev => ({
          ...prev,
          todayCompletedCount: newTodayCount,
          totalCompletedCount: newTotalCount,
          totalFocusTime: newTotalFocusTime,
          phoneUsageCount: newPhoneCount,
          longestStreak: finalStreak,
          averageFocusDuration: Math.round(newTotalFocusTime / newTotalCount) || prev.averageFocusDuration,
          history: updatedHistory
        }));

        if (newTodayCount === settings.dailyGoal) {
          setIsConfettiActive(true);
          sendBrowserNotification("Daily Goal Reached!", `Outstanding job! You completed all ${settings.dailyGoal} focus sessions for today!`);
        } else {
          sendBrowserNotification("Session Completed!", "Incredible focus session finished. Time to reward yourself with a break!");
        }

        if (currentCycle === 4) {
          nextType = 'longBreak';
          nextCycleCount = 1; // reset cycle
        } else {
          nextType = 'shortBreak';
          nextCycleCount = currentCycle + 1;
        }
      } else {
        nextType = 'shortBreak';
        nextCycleCount = currentCycle === 4 ? 1 : currentCycle + 1;
      }
    } else {
      if (!manualSkip) {
        sendBrowserNotification("Break Over!", "Time to regain full focus and make progress on your tasks!");
      }
      nextType = 'focus';
    }

    setSessionType(nextType);
    setCurrentCycle(nextCycleCount);
    setPhoneUsageInSession(0);
    
    const nextDuration = 
      nextType === 'focus' ? settings.focusDuration :
      nextType === 'shortBreak' ? settings.shortBreakDuration :
      settings.longBreakDuration;

    setTimeLeft(nextDuration * 60);
    setTotalDurationInSeconds(nextDuration * 60);
    setActiveQuote(getRandomQuote(nextType === 'focus' ? 'focus' : 'break'));

    if (settings.autoStartNextSession) {
      setIsRunning(true);
      playSynthAlert('start', !isMuted && settings.notificationSound);
    } else {
      setIsRunning(false);
    }
  }, [sessionType, currentCycle, timeLeft, totalDurationInSeconds, phoneUsageInSession, stats, settings, activeTaskId, isMuted, sendBrowserNotification]);

  // Main background countdown ticker
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            playSynthAlert('finish', !isMuted && settings.notificationSound);
            handleNextSession(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, handleNextSession, isMuted, settings.notificationSound]);

  // Toggle ambient noise player
  useEffect(() => {
    if (ambientSound !== 'none' && !isMuted) {
      startAmbientSound(ambientSound, true);
    } else {
      stopAmbientSound();
    }
    return () => {
      stopAmbientSound();
    };
  }, [ambientSound, isMuted]);

  // --- 4. User Interaction Actions ---

  const handleStartPause = () => {
    playSynthAlert('click', !isMuted && settings.notificationSound);
    if (!isRunning) {
      playSynthAlert('start', !isMuted && settings.notificationSound);
    } else {
      playSynthAlert('pause', !isMuted && settings.notificationSound);
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    playSynthAlert('click', !isMuted && settings.notificationSound);
    setIsRunning(false);
    const duration = 
      sessionType === 'focus' ? settings.focusDuration :
      sessionType === 'shortBreak' ? settings.shortBreakDuration :
      settings.longBreakDuration;
    
    setTimeLeft(duration * 60);
    setTotalDurationInSeconds(duration * 60);
    setPhoneUsageInSession(0);
  };

  const handleSkip = () => {
    playSynthAlert('click', !isMuted && settings.notificationSound);
    if (confirm("Are you sure you want to skip the current session?")) {
      handleNextSession(true);
    }
  };

  const handlePhonePenalty = () => {
    if (sessionType !== 'focus') return;
    
    playSynthAlert('click', !isMuted && settings.notificationSound);
    
    setTimeLeft(prev => prev + 600);
    setTotalDurationInSeconds(prev => prev + 600);
    setPhoneUsageInSession(prev => prev + 1);

    setShowPhoneAnim(true);
    setTimeout(() => {
      setShowPhoneAnim(false);
    }, 2000);
  };

  // Keyboard Shortcuts capturing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement).tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();
      
      if (key === ' ') {
        e.preventDefault();
        handleStartPause();
      } else if (key === 'r') {
        e.preventDefault();
        handleReset();
      } else if (key === 's') {
        e.preventDefault();
        handleSkip();
      } else if (key === 'p') {
        e.preventDefault();
        if (sessionType === 'focus') {
          handlePhonePenalty();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, sessionType, settings]);

  // Task list modifiers
  const handleAddTask = (title: string, estimatedPomodoros: number, isToday: boolean) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title,
      estimatedPomodoros,
      completedPomodoros: 0,
      completed: false,
      isToday,
      createdAt: Date.now(),
    };
    setTasks(prev => [newTask, ...prev]);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleDeleteTask = (id: string) => {
    if (activeTaskId === id) setActiveTaskId(null);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Stats controls
  const handleClearHistory = () => {
    setStats(DEFAULT_STATS);
  };

  // --- 5. Custom Computed Formatting Helpers ---

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeFocusTask = tasks.find(t => t.id === activeTaskId);

  // Dynamic Browser Tab Title updating
  useEffect(() => {
    const formattedTime = formatTime(timeLeft);
    const statusText = sessionType === 'focus' ? 'Time to focus!' : 'Time for a break!';
    document.title = `${formattedTime} - ${statusText}`;
  }, [timeLeft, sessionType]);

  // Dynamic colored checkmark favicon generation
  const updateFavicon = (type: SessionType) => {
    let color = '#ba4949'; // Focus red
    if (type === 'shortBreak') color = '#38858a'; // Teal/Green
    if (type === 'longBreak') color = '#397097'; // Blue

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
        <rect width="32" height="32" rx="8" fill="${color}"/>
        <path d="M9 16 l5 5 l9 -9" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    const encodedSvg = encodeURIComponent(svgString.trim());
    const dataUri = `data:image/svg+xml,${encodedSvg}`;

    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = dataUri;
  };

  useEffect(() => {
    updateFavicon(sessionType);
  }, [sessionType]);

  // Mode styling configurations
  const getBackgroundClass = () => {
    if (theme === 'light') {
      switch (sessionType) {
        case 'focus':
          return 'bg-[#ba4949] text-white';
        case 'shortBreak':
          return 'bg-[#38858a] text-white';
        case 'longBreak':
          return 'bg-[#397097] text-white';
      }
    } else {
      return 'bg-[#000000] text-white';
    }
  };

  const getButtonTextClass = () => {
    switch (sessionType) {
      case 'focus':
        return 'text-[#ba4949]';
      case 'shortBreak':
        return 'text-[#38858a]';
      case 'longBreak':
        return 'text-[#397097]';
    }
  };

  const getStartButtonClass = () => {
    return 'bg-white hover:bg-white/95 ' + getButtonTextClass();
  };

  const getProgressBarFillClass = () => {
    return 'bg-white';
  };

  const saveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    setIsSettingsOpen(false);
  };

  return (
    <div id="pomodoro-app-root" className={`min-h-screen flex flex-col font-sans transition-colors duration-500 ${getBackgroundClass()}`}>
      <CanvasConfetti active={isConfettiActive} onComplete={() => setIsConfettiActive(false)} />

      {/* --- Top Navbar --- */}
      {!isFullscreen && (
        <header id="app-header" className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-sm">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">Ming Pomodoro</h1>
              <p className="text-[10px] text-white/70 font-medium">Productivity Companion</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick stats indicator */}
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/10 text-xs font-semibold text-white border border-white/10 shadow-sm dark:shadow-none">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-white animate-pulse" />
                Streak: <strong>{stats.longestStreak}</strong>
              </span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-white" />
                Today: <strong>{stats.todayCompletedCount}/{settings.dailyGoal}</strong>
              </span>
            </div>

            {/* Controls */}
            <button
              type="button"
              id="btn-keyboard-help"
              onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
              title="Keyboard Shortcuts"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <Keyboard className="w-4.5 h-4.5" />
            </button>

            <button
              type="button"
              id="btn-volume-toggle"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "Unmute sounds" : "Mute sounds"}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4.5 h-4.5 text-red-200" /> : <Volume2 className="w-4.5 h-4.5" />}
            </button>

            <button
              type="button"
              id="btn-theme-toggle"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              title="Toggle Theme"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              {theme === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
            </button>

            <button
              type="button"
              id="btn-settings-open"
              onClick={() => setIsSettingsOpen(true)}
              title="Timer Settings"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <SettingsIcon className="w-4.5 h-4.5" />
            </button>
          </div>
        </header>
      )}

      {/* --- Main Workspace --- */}
      <main className={`flex-1 flex flex-col p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full transition-all duration-300 ${isFullscreen ? 'justify-center items-center' : ''}`}>
        
        {isFullscreen ? (
          /* --- Fullscreen Minimal Focus Mode --- */
          <div id="fullscreen-stage" className="flex flex-col items-center justify-center max-w-md w-full text-center relative py-12">
            <button
              type="button"
              id="btn-exit-fullscreen"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-0 right-0 p-3 text-white/85 hover:text-white bg-white/10 hover:bg-white/20 rounded-full shadow-lg transition-colors cursor-pointer"
              title="Exit Fullscreen"
            >
              <Minimize2 className="w-5 h-5" />
            </button>

            {/* Display Ring & Timer */}
            <div className="my-8">
              <span id="countdown-display" className="text-8xl md:text-9xl font-bold tracking-wider font-sans select-none text-white tabular-nums drop-shadow-md">
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Minimal Indicators */}
            <div className="mt-8 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-white/10 border border-white/20 text-white shadow-sm dark:shadow-none">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                {activeFocusTask ? `Working on: ${activeFocusTask.title}` : 'Focus Mode Active'}
              </div>
            </div>
            
            {/* Quick Keyboard Reference */}
            <div className="mt-8 flex gap-4 text-[10px] text-white/60 font-mono">
              <span>[Space] Start/Pause</span>
              <span>[R] Reset</span>
              <span>[P] Used Phone (+10m)</span>
            </div>
          </div>
        ) : (
          /* --- Standard Dashboard Layout --- */
          <div className="space-y-6 w-full">
            
            {/* Keyboard Shortcuts Help Banner */}
            {showShortcutsHelp && (
              <div id="shortcuts-help-banner" className="bg-white/10 border border-white/20 p-4 rounded-2xl flex items-start justify-between backdrop-blur-md shadow-lg">
                <div className="flex gap-3">
                  <div className="p-2 rounded-xl bg-white/20 text-white mt-0.5">
                    <Keyboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Keyboard Shortcuts</h4>
                    <p className="text-[11px] text-white/75 mt-0.5">Control your workspace instantly using global hotkeys:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <kbd className="px-2 py-1 text-[10px] font-bold font-mono bg-white/20 border border-white/10 rounded-md text-white shadow-sm">Space</kbd>
                        <span className="text-[11px] text-white/70">Play / Pause</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-2 py-1 text-[10px] font-bold font-mono bg-white/20 border border-white/10 rounded-md text-white shadow-sm">R</kbd>
                        <span className="text-[11px] text-white/70">Reset Session</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-2 py-1 text-[10px] font-bold font-mono bg-white/20 border border-white/10 rounded-md text-white shadow-sm">S</kbd>
                        <span className="text-[11px] text-white/70">Skip Mode</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-2 py-1 text-[10px] font-bold font-mono bg-white/20 border border-white/10 rounded-md text-white shadow-sm">P</kbd>
                        <span className="text-[11px] text-white/70">Used Phone (+10m)</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShortcutsHelp(false)}
                  className="p-1 text-white/60 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Hero Section: Timer Portion */}
            <div id="timer-hero-section" className="flex flex-col justify-center items-center py-4">
              {/* Timer Card */}
              <div className="w-full max-w-xl p-8 md:p-10 rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md flex flex-col items-center justify-center relative shadow-xl">
                
                {/* Fullscreen button */}
                <button
                  type="button"
                  id="btn-go-fullscreen"
                  onClick={() => setIsFullscreen(true)}
                  className="absolute top-4 right-4 p-2 text-white/60 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                  title="Fullscreen Focus Mode"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                {/* Mode selectors */}
                <div className="flex gap-1.5 p-1 bg-black/15 rounded-full mb-8 border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      playSynthAlert('click', !isMuted && settings.notificationSound);
                      setSessionType('focus');
                      setIsRunning(false);
                      setTimeLeft(settings.focusDuration * 60);
                      setTotalDurationInSeconds(settings.focusDuration * 60);
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      sessionType === 'focus'
                        ? 'bg-black/20 text-white shadow-sm'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Pomodoro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSynthAlert('click', !isMuted && settings.notificationSound);
                      setSessionType('shortBreak');
                      setIsRunning(false);
                      setTimeLeft(settings.shortBreakDuration * 60);
                      setTotalDurationInSeconds(settings.shortBreakDuration * 60);
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      sessionType === 'shortBreak'
                        ? 'bg-black/20 text-white shadow-sm'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Short Break
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSynthAlert('click', !isMuted && settings.notificationSound);
                      setSessionType('longBreak');
                      setIsRunning(false);
                      setTimeLeft(settings.longBreakDuration * 60);
                      setTotalDurationInSeconds(settings.longBreakDuration * 60);
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      sessionType === 'longBreak'
                        ? 'bg-black/20 text-white shadow-sm'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Long Break
                  </button>
                </div>

                {/* Massive Timer Countdown */}
                <div className="my-2 select-none">
                  <span id="countdown-display" className="text-7xl md:text-8xl lg:text-9xl font-bold tracking-wider font-sans text-white tabular-nums drop-shadow-sm">
                    {formatTime(timeLeft)}
                  </span>
                </div>

                {/* Active Focus Task banner */}
                {sessionType === 'focus' && activeFocusTask && (
                  <div className="text-xs font-semibold text-white/95 max-w-sm truncate mt-3 flex items-center gap-1.5 justify-center bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Active: {activeFocusTask.title}
                  </div>
                )}

                {/* Operational Controls Row */}
                <div className="flex items-center gap-4 mt-8 w-full justify-center">
                  <button
                    type="button"
                    id="timer-reset-btn"
                    onClick={handleReset}
                    title="Reset Session"
                    className="p-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/10 transition-all active:scale-95 cursor-pointer shadow-md"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    id="timer-start-pause-btn"
                    onClick={handleStartPause}
                    className={`px-10 py-4 ${getStartButtonClass()} rounded-2xl font-bold text-sm tracking-widest uppercase shadow-md hover:shadow-lg transition-all active:scale-95 duration-200 cursor-pointer`}
                  >
                    {isRunning ? 'Pause' : 'Start'}
                  </button>

                  <button
                    type="button"
                    id="timer-skip-btn"
                    onClick={handleSkip}
                    title="Skip Session"
                    className="p-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/10 transition-all active:scale-95 cursor-pointer shadow-md"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                {/* Phone penalty trigger (+10 min) */}
                {sessionType === 'focus' && (
                  <div className="mt-5 flex flex-col items-center">
                    <button
                      type="button"
                      id="btn-phone-penalty"
                      onClick={handlePhonePenalty}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-full transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                      title="Trigger +10m penalty for using phone during work"
                    >
                      <PhoneOff className="w-3.5 h-3.5 text-red-200" />
                      I Used My Phone (+10m)
                    </button>
                    
                    {phoneUsageInSession > 0 && (
                      <span id="phone-penalty-badge" className="text-[10px] text-red-200 font-bold mt-2 font-mono">
                        Phone used: {phoneUsageInSession} {phoneUsageInSession === 1 ? 'time' : 'times'} (+{phoneUsageInSession * 10}m)
                      </span>
                    )}
                  </div>
                )}

                {/* Break session indicators */}
                {sessionType !== 'focus' && (
                  <span className="text-xs text-white/70 mt-4 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-white/85" /> Breathe in, breathe out
                  </span>
                )}
              </div>

              {/* Floating Animation +10 Minutes Added overlay */}
              {showPhoneAnim && (
                <div
                  id="phone-penalty-animation"
                  className="absolute bg-white text-slate-800 font-bold text-xs px-4 py-2 rounded-full shadow-lg border border-white/35 animate-bounce pointer-events-none z-10"
                >
                  +10 Minutes Added
                </div>
              )}

              {/* Ambient sound generator */}
              <div className="w-full max-w-xl mt-6 p-4 rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md flex flex-col md:flex-row items-center justify-between shadow-xl gap-4">
                <div className="text-center md:text-left">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-center md:justify-start gap-1.5 mb-0.5">
                    <Radio className="w-4 h-4 text-white" />
                    Ambient Sounds
                  </h4>
                  <p className="text-[10px] text-white/60 font-medium">Immersive background focus noise</p>
                </div>

                <div className="grid grid-cols-5 gap-1.5 w-full md:w-auto max-w-md">
                  <button
                    type="button"
                    id="ambient-btn-none"
                    onClick={() => setAmbientSound('none')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      ambientSound === 'none'
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <VolumeX className="w-3.5 h-3.5 mb-0.5" />
                    <span className="text-[9px]">Mute</span>
                  </button>

                  <button
                    type="button"
                    id="ambient-btn-rain"
                    onClick={() => setAmbientSound('rain')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      ambientSound === 'rain'
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <CloudRain className="w-3.5 h-3.5 mb-0.5" />
                    <span className="text-[9px]">Rain</span>
                  </button>

                  <button
                    type="button"
                    id="ambient-btn-forest"
                    onClick={() => setAmbientSound('forest')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      ambientSound === 'forest'
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <Trees className="w-3.5 h-3.5 mb-0.5" />
                    <span className="text-[9px]">Forest</span>
                  </button>

                  <button
                    type="button"
                    id="ambient-btn-cafe"
                    onClick={() => setAmbientSound('cafe')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      ambientSound === 'cafe'
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <Coffee className="w-3.5 h-3.5 mb-0.5" />
                    <span className="text-[9px]">Cafe</span>
                  </button>

                  <button
                    type="button"
                    id="ambient-btn-white"
                    onClick={() => setAmbientSound('whiteNoise')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      ambientSound === 'whiteNoise'
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 mb-0.5" />
                    <span className="text-[9px]">White</span>
                  </button>
                </div>
              </div>

              {/* Quotes generator */}
              {activeQuote && (
                <div className="text-center max-w-lg mx-auto text-white/80 italic text-xs md:text-sm px-4 mt-8 select-none">
                  "{activeQuote.text}" — <span className="not-italic font-semibold text-white/90">{activeQuote.author}</span>
                </div>
              )}
            </div>

            {/* Below fold section: Tasks, Goals and Analytics (revealed on scroll) */}
            <div id="below-fold-section" className="border-t border-white/20 pt-10 space-y-10 w-full max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto">
              
              {/* Cycle and Goal Progress Panel */}
              <div className="p-5 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Goal progress */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      Daily Goal Progress
                    </span>
                    <span className="text-xs font-mono font-bold text-white/95">
                      {stats.todayCompletedCount} / {settings.dailyGoal} completed ({Math.min(100, Math.round((stats.todayCompletedCount / settings.dailyGoal) * 100)) || 0}%)
                    </span>
                  </div>
                  {/* Progress bar wrapper */}
                  <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden border border-white/5">
                    <div
                      id="daily-goal-progress-bar"
                      className={`${getProgressBarFillClass()} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(100, (stats.todayCompletedCount / settings.dailyGoal) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Current cycle status indicator */}
                <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Current Cycle Status</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    {Array.from({ length: 4 }).map((_, idx) => {
                      const stepNum = idx + 1;
                      const isDone = stepNum < currentCycle || (sessionType !== 'focus' && stepNum === currentCycle);
                      const isCurrent = stepNum === currentCycle && sessionType === 'focus';
                      
                      return (
                        <div
                          key={idx}
                          className={`flex-1 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all ${
                            isDone
                              ? 'bg-white/20 border-white/30 text-white'
                              : 'border-white/10 text-white/40 bg-transparent'
                          } ${isCurrent ? 'bg-white ' + getButtonTextClass() + ' border-white font-bold animate-pulse' : ''}`}
                          title={`Session ${stepNum}`}
                        >
                          {stepNum}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tasks Backlog Section */}
              <div id="tasks-backlog-wrapper">
                <TaskSidebar
                  tasks={tasks}
                  activeTaskId={activeTaskId}
                  onSelectActiveTask={setActiveTaskId}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                />
              </div>

              {/* --- Historical Statistics Section --- */}
              <div id="dashboard-statistics-wrapper" className="border-t border-white/20 pt-8 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <BarChart className="w-5 h-5" />
                      Productivity Analytics Dashboard
                    </h2>
                    <p className="text-xs text-white/70">Review your historic focus records, phone penalties, and streaks</p>
                  </div>
                </div>

                <StatisticsDashboard stats={stats} onClearHistory={handleClearHistory} />
              </div>

            </div>

          </div>
        )}
      </main>

      {/* --- Footer bar --- */}
      {!isFullscreen && (
        <footer className="border-t border-white/10 mt-auto py-6 text-center text-xs text-white/60 font-mono tracking-wide">
          <p>Ming Pomodoro</p>
        </footer>
      )}

      {/* --- Settings Modal --- */}
      {isSettingsOpen && renderSettingsModal()}
    </div>
  );

  // --- Sub-renderer 2: Settings Modal ---
  function renderSettingsModal() {
    return (
      <div id="settings-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          id="modal-backdrop"
          onClick={() => setIsSettingsOpen(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Content Box */}
        <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/20 rounded-3xl shadow-2xl p-6 max-w-md w-full relative z-10 animate-in fade-in zoom-in-95 duration-200 text-slate-800 dark:text-white">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/5 dark:border-white/10">
            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-slate-600 dark:text-white" />
              Timer Settings
            </h3>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="text-slate-500 dark:text-white/60 hover:text-slate-800 dark:hover:text-white rounded-lg p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const focusVal = Math.max(1, Math.min(180, parseInt(formData.get('focusDuration') as string) || 25));
              const shortVal = Math.max(1, Math.min(180, parseInt(formData.get('shortBreakDuration') as string) || 5));
              const longVal = Math.max(1, Math.min(180, parseInt(formData.get('longBreakDuration') as string) || 15));
              const goalVal = Math.max(1, Math.min(24, parseInt(formData.get('dailyGoal') as string) || 4));

              saveSettings({
                focusDuration: focusVal,
                shortBreakDuration: shortVal,
                longBreakDuration: longVal,
                autoStartNextSession: formData.get('autoStartNextSession') === 'on',
                notificationSound: formData.get('notificationSound') === 'on',
                browserNotifications: formData.get('browserNotifications') === 'on',
                dailyGoal: goalVal
              });
            }}
            className="space-y-4 text-sm text-slate-800 dark:text-white"
          >
            {/* Focus Duration */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/60 mb-1.5">Focus Duration (minutes)</label>
              <input
                type="number"
                name="focusDuration"
                min="1"
                max="180"
                defaultValue={settings.focusDuration}
                className="w-full px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-white text-slate-800 dark:text-white font-semibold"
              />
            </div>

            {/* Break Durations */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/60 mb-1.5">Short Break</label>
                <input
                  type="number"
                  name="shortBreakDuration"
                  min="1"
                  max="180"
                  defaultValue={settings.shortBreakDuration}
                  className="w-full px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-white text-slate-800 dark:text-white font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/60 mb-1.5">Long Break</label>
                <input
                  type="number"
                  name="longBreakDuration"
                  min="1"
                  max="180"
                  defaultValue={settings.longBreakDuration}
                  className="w-full px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-white text-slate-800 dark:text-white font-semibold"
                />
              </div>
            </div>

            {/* Daily Goal target */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/60 mb-1.5">Daily Goal (Pomodoros)</label>
              <input
                type="number"
                name="dailyGoal"
                min="1"
                max="24"
                defaultValue={settings.dailyGoal}
                className="w-full px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-white text-slate-800 dark:text-white font-semibold"
              />
            </div>

            {/* Checkbox triggers */}
            <div className="space-y-2.5 pt-2 border-t border-black/5 dark:border-white/10">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="autoStartNextSession"
                  defaultChecked={settings.autoStartNextSession}
                  className="rounded border-slate-300 dark:border-white/20 text-slate-800 focus:ring-slate-400 dark:focus:ring-white w-4 h-4 bg-transparent"
                />
                <span className="font-medium text-xs text-slate-600 dark:text-white/80">Auto-start next session automatically</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="notificationSound"
                  defaultChecked={settings.notificationSound}
                  className="rounded border-slate-300 dark:border-white/20 text-slate-800 focus:ring-slate-400 dark:focus:ring-white w-4 h-4 bg-transparent"
                />
                <span className="font-medium text-xs text-slate-600 dark:text-white/80">Play tone on start/pause/complete</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="browserNotifications"
                  defaultChecked={settings.browserNotifications}
                  className="rounded border-slate-300 dark:border-white/20 text-slate-800 focus:ring-slate-400 dark:focus:ring-white w-4 h-4 bg-transparent"
                />
                <span className="font-medium text-xs text-slate-600 dark:text-white/80">Display browser desk notifications</span>
              </label>
            </div>

            {/* Submit & Reset actions */}
            <div className="flex gap-2 pt-4 border-t border-black/5 dark:border-white/10">
              <button
                type="button"
                id="btn-settings-reset-defaults"
                onClick={() => {
                  if (confirm("Reset settings back to default pomodoro values?")) {
                    saveSettings(DEFAULT_SETTINGS);
                  }
                }}
                className="flex-1 py-2 text-xs font-semibold text-slate-500 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors border border-black/10 dark:border-white/10 cursor-pointer"
              >
                Defaults
              </button>
              <button
                type="submit"
                id="btn-settings-save"
                className="flex-1 py-2 text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-white/90 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
