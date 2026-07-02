import React, { useState } from 'react';
import { Task } from '../types';
import { Play, CheckSquare, Square, Trash2, Edit2, Plus, Calendar, Inbox, Check, X } from 'lucide-react';

interface TaskSidebarProps {
  tasks: Task[];
  activeTaskId: string | null;
  onSelectActiveTask: (id: string | null) => void;
  onAddTask: (title: string, estimatedPomodoros: number, isToday: boolean) => void;
  onUpdateTask: (updatedTask: Task) => void;
  onDeleteTask: (id: string) => void;
}

export default function TaskSidebar({
  tasks,
  activeTaskId,
  onSelectActiveTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}: TaskSidebarProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newEstPomodoros, setNewEstPomodoros] = useState(1);
  const [newTaskIsToday, setNewTaskIsToday] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingEst, setEditingEst] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask(newTaskTitle.trim(), newEstPomodoros, newTaskIsToday);
    setNewTaskTitle('');
    setNewEstPomodoros(1);
    setIsAdding(false);
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
    setEditingEst(task.estimatedPomodoros);
  };

  const saveEdit = (task: Task) => {
    if (!editingTitle.trim()) return;
    onUpdateTask({
      ...task,
      title: editingTitle.trim(),
      estimatedPomodoros: editingEst,
    });
    setEditingTaskId(null);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
  };

  const todayTasks = tasks.filter(t => t.isToday);
  const backlogTasks = tasks.filter(t => !t.isToday);

  const renderTaskItem = (task: Task) => {
    const isEditing = editingTaskId === task.id;
    const isActive = activeTaskId === task.id;

    return (
      <div
        key={task.id}
        id={`task-item-${task.id}`}
        className={`group relative flex flex-col p-3 rounded-xl border transition-all duration-200 ${
          isActive
            ? 'bg-white/20 border-white/40 shadow-sm text-white'
            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-white'
        } ${task.completed ? 'opacity-50' : ''}`}
      >
        {isEditing ? (
          <div className="flex flex-col gap-2 w-full">
            <input
              type="text"
              id={`edit-task-input-${task.id}`}
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              className="px-3 py-1.5 text-sm bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-white w-full text-white"
              autoFocus
            />
            <div className="flex justify-between items-center mt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/70">Est:</span>
                <div className="flex items-center border border-white/10 rounded-lg bg-black/20 px-1">
                  <button
                    type="button"
                    onClick={() => setEditingEst(Math.max(1, editingEst - 1))}
                    className="px-1.5 py-0.5 text-xs text-white/70 hover:text-white"
                  >
                    -
                  </button>
                  <span className="px-1.5 text-xs font-semibold text-white">{editingEst} focus</span>
                  <button
                    type="button"
                    onClick={() => setEditingEst(Math.min(10, editingEst + 1))}
                    className="px-1.5 py-0.5 text-xs text-white/70 hover:text-white"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  id={`edit-task-save-${task.id}`}
                  onClick={() => saveEdit(task)}
                  className="p-1 text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  id={`edit-task-cancel-${task.id}`}
                  onClick={cancelEdit}
                  className="p-1 text-white/60 hover:text-white hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              id={`task-toggle-${task.id}`}
              onClick={() => onUpdateTask({ ...task, completed: !task.completed })}
              className="mt-0.5 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              {task.completed ? (
                <CheckSquare className="w-4.5 h-4.5 text-white" />
              ) : (
                <Square className="w-4.5 h-4.5" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  task.completed ? 'line-through text-white/40' : 'text-white'
                }`}
              >
                {task.title}
              </p>
              
              <div className="flex items-center gap-2 mt-1.5">
                <span className="flex items-center gap-0.5 text-xs text-white/60">
                  {Array.from({ length: task.estimatedPomodoros }).map((_, i) => (
                    <span
                      key={i}
                      className={
                        i < task.completedPomodoros
                          ? 'text-white font-bold'
                          : 'text-white/20'
                      }
                    >
                      <span className="w-1.5 h-1.5 rounded-full inline-block bg-current" />
                    </span>
                  ))}
                  <span className="ml-1 text-[10px] font-mono opacity-80">
                    ({task.completedPomodoros}/{task.estimatedPomodoros})
                  </span>
                </span>
                
                {task.isToday && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-white/10 text-white/90">
                    Today
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {!task.completed && (
                <button
                  type="button"
                  id={`task-select-active-${task.id}`}
                  onClick={() => onSelectActiveTask(isActive ? null : task.id)}
                  title={isActive ? "Deselect active focus task" : "Select as active focus task"}
                  className={`p-1 rounded-md transition-colors ${
                    isActive
                      ? 'text-white bg-white/20'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  } cursor-pointer`}
                >
                  <Play className={`w-3.5 h-3.5 ${isActive ? 'fill-white' : ''}`} />
                </button>
              )}
              <button
                type="button"
                id={`task-edit-${task.id}`}
                onClick={() => startEditing(task)}
                className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id={`task-delete-${task.id}`}
                onClick={() => onDeleteTask(task.id)}
                className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="task-sidebar" className="flex flex-col w-full text-white">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5" />
          Tasks
        </h2>
      </div>

      <hr className="border-white/20 mb-6" />

      {isAdding && (
        <form
          id="add-task-form"
          onSubmit={handleSubmit}
          className="mb-4 p-4 bg-white/10 border border-white/20 rounded-2xl shadow-sm flex flex-col gap-3"
        >
          <input
            type="text"
            id="task-title-input"
            placeholder="What are you working on?"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="px-3 py-2 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-white text-white placeholder-white/40"
            autoFocus
          />
          
          <div className="flex justify-between items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 text-xs text-white/70">
              <span>Est:</span>
              <div className="flex items-center border border-white/10 rounded-lg bg-black/20 px-1">
                <button
                  type="button"
                  onClick={() => setNewEstPomodoros(Math.max(1, newEstPomodoros - 1))}
                  className="px-2 py-1 hover:text-white font-semibold cursor-pointer"
                >
                  -
                </button>
                <span className="px-1 text-white font-medium">{newEstPomodoros} focus</span>
                <button
                  type="button"
                  onClick={() => setNewEstPomodoros(Math.min(10, newEstPomodoros + 1))}
                  className="px-2 py-1 hover:text-white font-semibold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              id="task-toggle-today-plan"
              onClick={() => setNewTaskIsToday(!newTaskIsToday)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                newTaskIsToday
                  ? 'bg-white/20 border-white/30 text-white'
                  : 'bg-transparent border-white/10 text-white/60 hover:text-white hover:border-white/20'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              {newTaskIsToday ? 'Today' : 'Inbox'}
            </button>
          </div>

          <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-white/10">
            <button
              type="button"
              id="add-task-cancel-btn"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="add-task-save-btn"
              disabled={!newTaskTitle.trim()}
              className="px-4 py-1.5 text-xs bg-white text-slate-800 disabled:opacity-50 hover:bg-white/90 rounded-lg font-bold shadow-sm transition-colors cursor-pointer"
            >
              Add Task
            </button>
          </div>
        </form>
      )}

      {!isAdding && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="mb-6 w-full py-4 rounded-xl border-dashed border-2 border-white/30 text-white/80 hover:text-white hover:border-white/50 hover:bg-white/5 transition-all font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      )}

      <div className="flex-1 space-y-6">
        {/* Today's Tasks */}
        <div>
          <div className="flex items-center gap-1 text-xs font-bold text-white/60 tracking-wider uppercase mb-3">
            <Calendar className="w-3.5 h-3.5 text-white/80" />
            <span>Today's Focus ({todayTasks.filter(t => !t.completed).length})</span>
          </div>
          {todayTasks.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-white/10 rounded-xl">
              <p className="text-xs text-white/60">No tasks planned for today.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.map(renderTaskItem)}
            </div>
          )}
        </div>

        {/* Backlog/Inbox Tasks */}
        <div>
          <div className="flex items-center gap-1 text-xs font-bold text-white/60 tracking-wider uppercase mb-3">
            <Inbox className="w-3.5 h-3.5 text-white/80" />
            <span>Task Backlog ({backlogTasks.length})</span>
          </div>
          {backlogTasks.length === 0 ? (
            backlogTasks.length === 0 && todayTasks.length > 0 && (
              <div className="text-center py-3">
                <p className="text-xs text-white/40">Inbox is clear!</p>
              </div>
            )
          ) : (
            <div className="space-y-2">
              {backlogTasks.map(renderTaskItem)}
            </div>
          )}
        </div>
      </div>

      {activeTaskId && (
        <div className="mt-6 p-3 bg-white/10 border border-white/20 rounded-xl flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Active Focus</p>
            <p className="text-xs text-white font-medium truncate mt-0.5">
              {tasks.find(t => t.id === activeTaskId)?.title}
            </p>
          </div>
          <button
            type="button"
            id="clear-active-task-btn"
            onClick={() => onSelectActiveTask(null)}
            className="p-1 text-white hover:underline transition-all text-xs font-bold cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
