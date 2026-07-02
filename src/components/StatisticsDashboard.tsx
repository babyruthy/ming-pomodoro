import { Statistics } from '../types';
import { Clock, Flame, PhoneOff, Award, FileSpreadsheet, Calendar, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface StatisticsDashboardProps {
  stats: Statistics;
  onClearHistory: () => void;
}

export default function StatisticsDashboard({ stats, onClearHistory }: StatisticsDashboardProps) {
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Parse last 7 days of history for SVG bar chart
  const getWeeklyData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    
    // Create map for the last 7 days (including today)
    const result = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      return {
        dateStr: d.toDateString(),
        dayLabel: days[d.getDay()],
        minutes: 0,
        count: 0
      };
    });

    stats.history.forEach((item) => {
      if (item.completed && item.type === 'focus') {
        const itemDate = new Date(item.timestamp).toDateString();
        const found = result.find(r => r.dateStr === itemDate);
        if (found) {
          found.minutes += item.duration;
          found.count += 1;
        }
      }
    });

    return result;
  };

  const weeklyData = getWeeklyData();
  const maxMinutes = Math.max(...weeklyData.map(d => d.minutes), 30); // scale target at least 30min

  // Export history to CSV
  const handleExportCSV = () => {
    if (stats.history.length === 0) {
      alert("No session history to export yet!");
      return;
    }

    const headers = ["ID", "Date & Time", "Type", "Duration (Minutes)", "Phone Penalties (Clicks)", "Completed Successfully"];
    const rows = stats.history.map(item => [
      item.id,
      new Date(item.timestamp).toLocaleString(),
      item.type === 'focus' ? 'Focus Session' : item.type === 'shortBreak' ? 'Short Break' : 'Long Break',
      item.duration,
      item.phoneUsageCount,
      item.completed ? 'Yes' : 'No'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pomodoro_focus_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatHoursMinutes = (totalMinutes: number) => {
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins}m`;
  };

  return (
    <div id="statistics-dashboard" className="space-y-6 text-white">
      {/* Overview Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1 */}
        <div className="bg-white/10 border border-white/20 p-4 rounded-2xl shadow-md backdrop-blur-md hover:bg-white/15 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Today's Focus</span>
            <Award className="w-4 h-4 text-white" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1">
            <span id="stat-today-count" className="text-2xl font-bold font-sans text-white">{stats.todayCompletedCount}</span>
            <span className="text-xs text-white/60 font-light">sessions</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white/10 border border-white/20 p-4 rounded-2xl shadow-md backdrop-blur-md hover:bg-white/15 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Total Focus</span>
            <Award className="w-4 h-4 text-white" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1">
            <span id="stat-total-count" className="text-2xl font-bold font-sans text-white">{stats.totalCompletedCount}</span>
            <span className="text-xs text-white/60 font-light">total</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white/10 border border-white/20 p-4 rounded-2xl shadow-md backdrop-blur-md hover:bg-white/15 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Focus Time</span>
            <Clock className="w-4 h-4 text-white" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1">
            <span id="stat-focus-time" className="text-2xl font-bold font-sans text-white">
              {formatHoursMinutes(stats.totalFocusTime)}
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white/10 border border-white/20 p-4 rounded-2xl shadow-md backdrop-blur-md hover:bg-white/15 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Focus Streak</span>
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1">
            <span id="stat-streak" className="text-2xl font-bold font-sans text-white">{stats.longestStreak}</span>
            <span className="text-xs text-white/60 font-light">streak</span>
          </div>
        </div>

        {/* Card 5 */}
        <div className="bg-white/10 border border-white/20 p-4 rounded-2xl shadow-md backdrop-blur-md hover:bg-white/15 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Phone Usage</span>
            <PhoneOff className="w-4 h-4 text-white" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1">
            <span id="stat-phone-count" className="text-2xl font-bold font-sans text-white">{stats.phoneUsageCount}</span>
            <span className="text-xs text-white/60 font-light">times</span>
          </div>
        </div>

        {/* Card 6 */}
        <div className="bg-white/10 border border-white/20 p-4 rounded-2xl shadow-md backdrop-blur-md hover:bg-white/15 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Avg Session</span>
            <Clock className="w-4 h-4 text-white" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1">
            <span id="stat-avg-duration" className="text-2xl font-bold font-sans text-white">
              {stats.averageFocusDuration.toFixed(0)}
            </span>
            <span className="text-xs text-white/60 font-light">mins</span>
          </div>
        </div>
      </div>

      {/* Graphs & Detailed Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Productivity SVG Graph */}
        <div className="bg-white/10 border border-white/20 p-5 rounded-2xl shadow-md backdrop-blur-md lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Weekly Productivity</h3>
              <p className="text-xs text-white/60">Total focus minutes over the last 7 days</p>
            </div>
            <span className="text-xs font-medium text-white/80 bg-white/10 px-2.5 py-1 rounded-full flex items-center gap-1 border border-white/10">
              <Calendar className="w-3.5 h-3.5" />
              Past 7 Days
            </span>
          </div>

          {/* Interactive Responsive SVG Bar Chart */}
          <div className="relative w-full h-[180px] mt-2 flex items-end">
            <svg viewBox="0 0 560 180" className="w-full h-full overflow-visible">
              {/* Guidelines */}
              <line x1="40" y1="20" x2="540" y2="20" className="stroke-white/10" strokeDasharray="3,3" />
              <line x1="40" y1="80" x2="540" y2="80" className="stroke-white/10" strokeDasharray="3,3" />
              <line x1="40" y1="140" x2="540" y2="140" className="stroke-white/20" />

              {/* Y Axis Labels */}
              <text x="15" y="24" className="text-[10px] fill-white/60 font-mono text-right">{maxMinutes}m</text>
              <text x="15" y="84" className="text-[10px] fill-white/60 font-mono text-right">{Math.round(maxMinutes / 2)}m</text>
              <text x="15" y="144" className="text-[10px] fill-white/60 font-mono text-right">0m</text>

              {weeklyData.map((data, i) => {
                const barWidth = 44;
                const gap = 24;
                const startX = 55 + i * (barWidth + gap);
                const barHeight = Math.max(4, (data.minutes / maxMinutes) * 110);
                const startY = 140 - barHeight;

                const isHovered = hoveredBarIndex === i;

                return (
                  <g key={i} onMouseEnter={() => setHoveredBarIndex(i)} onMouseLeave={() => setHoveredBarIndex(null)}>
                    {/* Shadow interactive region */}
                    <rect
                      x={startX - 6}
                      y="15"
                      width={barWidth + 12}
                      height="130"
                      fill="transparent"
                      className="cursor-pointer"
                    />
                    
                    {/* Visual Bar */}
                    <rect
                      x={startX}
                      y={startY}
                      width={barWidth}
                      height={barHeight}
                      rx="6"
                      className={`transition-all duration-300 ${
                        isHovered 
                          ? 'fill-white filter drop-shadow-[0_2px_8px_rgba(255,255,255,0.6)]'
                          : 'fill-white/30'
                      }`}
                    />

                    {/* Popover tooltip */}
                    {isHovered && (
                      <g className="transition-all duration-200">
                        <rect
                          x={startX - 15}
                          y={startY - 35}
                          width={barWidth + 30}
                          height="24"
                          rx="4"
                          fill="#1e293b"
                          className="shadow-md"
                        />
                        <text
                          x={startX + barWidth / 2}
                          y={startY - 19}
                          textAnchor="middle"
                          fill="#ffffff"
                          className="text-[10px] font-bold font-mono"
                        >
                          {data.minutes} min ({data.count} focus)
                        </text>
                      </g>
                    )}

                    {/* Day label */}
                    <text
                      x={startX + barWidth / 2}
                      y="160"
                      textAnchor="middle"
                      className={`text-xs font-medium ${
                        isHovered ? 'fill-white font-semibold' : 'fill-white/60'
                      }`}
                    >
                      {data.dayLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Session Log & Control */}
        <div className="bg-white/10 border border-white/20 p-5 rounded-2xl shadow-md backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Session History</h3>
              <div className="flex gap-1">
                <button
                  type="button"
                  id="btn-export-csv"
                  onClick={handleExportCSV}
                  title="Export history as CSV"
                  className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  id="btn-clear-history"
                  onClick={() => {
                    if (confirm("Are you sure you want to clear your entire pomodoro focus history? This will reset all statistics!")) {
                      onClearHistory();
                    }
                  }}
                  title="Clear history"
                  className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Logs List */}
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
              {stats.history.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-white/60">No completed sessions logged yet.</p>
                  <p className="text-[10px] text-white/40 font-light mt-0.5">Your sessions will appear here automatically.</p>
                </div>
              ) : (
                stats.history.slice(0, 50).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-xl border border-white/10 bg-white/5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-white">
                          {item.type === 'focus' ? 'Focus Session' : item.type === 'shortBreak' ? 'Short Break' : 'Long Break'}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.completed ? 'bg-green-400' : 'bg-red-400'}`} />
                      </div>
                      <p className="text-[9px] text-white/60 font-mono mt-0.5">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-white">
                        +{item.duration}m
                      </span>
                      {item.phoneUsageCount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 font-bold font-mono rounded-full bg-white/10 text-white">
                          phone x{item.phoneUsageCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-[11px] text-white/40">
            <span>Showing last {Math.min(50, stats.history.length)} items</span>
            <span>Local Sync Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
