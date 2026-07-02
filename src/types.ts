export type SessionType = 'focus' | 'shortBreak' | 'longBreak';

export interface Settings {
  focusDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  autoStartNextSession: boolean;
  notificationSound: boolean;
  browserNotifications: boolean;
  dailyGoal: number; // number of Pomodoros
}

export interface Task {
  id: string;
  title: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  completed: boolean;
  isToday: boolean;
  createdAt: number;
}

export interface PomodoroHistoryItem {
  id: string;
  timestamp: number; // Epoch time
  type: SessionType;
  duration: number; // minutes actually spent
  phoneUsageCount: number;
  completed: boolean;
}

export interface Statistics {
  todayCompletedCount: number;
  totalCompletedCount: number;
  totalFocusTime: number; // in minutes
  longestStreak: number; // consecutive focus sessions completed
  phoneUsageCount: number;
  averageFocusDuration: number; // in minutes
  history: PomodoroHistoryItem[];
}

export interface Quote {
  text: string;
  author: string;
}

export interface AmbientSound {
  id: 'none' | 'rain' | 'forest' | 'whiteNoise' | 'cafe';
  name: string;
  isPlaying: boolean;
}
