interface TaskFormState {
  name: string;
  minutes: number;
  minutesInput: string;
  breakTime: number;
  breakInput: string;
  urgent: boolean;
  interest: number;
  interestInput: string;
  show: boolean;
}

interface TaskAddFormProps {
  form: TaskFormState;
  setField: <K extends keyof TaskFormState>(
    key: K,
    value: TaskFormState[K],
  ) => void;
  handleBlurMinutes: (value: string) => void;
  handleBlurBreak: (value: string) => void;
  handleBlurInterest: (value: string) => void;
  handleAddTask: () => void;
  hideForm: () => void;
  t: Record<string, string>;
}

export function TaskAddForm({
  form,
  setField,
  handleBlurMinutes,
  handleBlurBreak,
  handleBlurInterest,
  handleAddTask,
  hideForm,
  t,
}: TaskAddFormProps) {
  return (
    <div className="p-4 bg-card rounded-2xl border-2 border-primary/30 zen-shadow-card motion-safe:animate-scale-in space-y-4">
      <input
        type="text"
        value={form.name}
        onChange={(e) => setField("name", e.target.value)}
        placeholder={t.taskNamePlaceholder || "Task name..."}
        className="w-full p-3 bg-secondary rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        autoFocus // eslint-disable-line jsx-a11y/no-autofocus
        onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
      />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {t.durationMinutes || "Duration (min)"}
          </label>
          <input
            type="number"
            value={form.minutesInput}
            onChange={(e) => setField("minutesInput", e.target.value)}
            onBlur={(e) => handleBlurMinutes(e.target.value)}
            min="1"
            max="480"
            className="w-full p-2 bg-secondary rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={t.durationMinutes || "Duration (min)"}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {t.breakTime || "Break (min)"}
          </label>
          <input
            type="number"
            value={form.breakInput}
            onChange={(e) => setField("breakInput", e.target.value)}
            onBlur={(e) => handleBlurBreak(e.target.value)}
            min="0"
            max="60"
            className="w-full p-2 bg-secondary rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={t.breakTime || "Break (min)"}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {t.interestLevel || "Interest"}
          </label>
          <input
            type="number"
            value={form.interestInput}
            onChange={(e) => setField("interestInput", e.target.value)}
            onBlur={(e) => handleBlurInterest(e.target.value)}
            min="1"
            max="10"
            className="w-full p-2 bg-secondary rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={t.interestLevel || "Interest"}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.urgent}
          onChange={(e) => setField("urgent", e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm text-foreground">
          {t.markAsUrgent || "Mark as urgent"}
        </span>
      </label>

      <div className="flex gap-2">
        <button
          onClick={handleAddTask}
          disabled={!form.name.trim()}
          className="flex-1 py-3 zen-gradient text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.addTask || "Add Task"}
        </button>
        <button
          onClick={hideForm}
          className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
        >
          {t.cancel || "Cancel"}
        </button>
      </div>
    </div>
  );
}
