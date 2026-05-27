// Pure-ish day computation engine. Takes punches + schedule + holidays for a date.
export type DayPunch = { ts: string; kind: "entrada" | "saida" | "inicio_intervalo" | "fim_intervalo" };
export type WeeklyPattern = Record<
  string, // "0" Sun .. "6" Sat
  { start: string; end: string; break_min?: number } | null
>;

export type Schedule = {
  kind: string;
  weekly_pattern: WeeklyPattern;
  tolerance_min: number;
  night_shift_start?: string | null;
  night_shift_end?: string | null;
  interjornada_min: number;
  intrajornada_min: number;
};

export type DaySummary = {
  date: string;
  worked_min: number;
  expected_min: number;
  late_min: number;
  extra_min_50: number;
  extra_min_100: number;
  night_min: number;
  balance_min: number;
  is_holiday: boolean;
  is_weekend: boolean;
  is_scheduled: boolean;
  warnings: string[];
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function nightOverlapMinutes(
  startTs: Date,
  endTs: Date,
  nightStart: string,
  nightEnd: string
): number {
  // Compute overlap of [start,end] with night window (which wraps midnight)
  let total = 0;
  const cursor = new Date(startTs);
  while (cursor < endTs) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    const nsStart = new Date(dayStart);
    const [nh, nm] = nightStart.split(":").map(Number);
    nsStart.setHours(nh, nm, 0, 0);
    const nsEnd = new Date(dayStart);
    const [eh, em] = nightEnd.split(":").map(Number);
    nsEnd.setHours(eh, em, 0, 0);
    if (nsEnd <= nsStart) nsEnd.setDate(nsEnd.getDate() + 1); // wrap
    const segEnd = new Date(dayStart);
    segEnd.setDate(segEnd.getDate() + 1);
    const segCurEnd = endTs < segEnd ? endTs : segEnd;

    const oStart = cursor > nsStart ? cursor : nsStart;
    const oEnd = segCurEnd < nsEnd ? segCurEnd : nsEnd;
    if (oEnd > oStart) total += (oEnd.getTime() - oStart.getTime()) / 60000;

    cursor.setTime(segEnd.getTime());
  }
  return Math.round(total);
}

export function computeDay(input: {
  date: string; // yyyy-mm-dd
  punches: DayPunch[];
  schedule: Schedule | null;
  isHoliday: boolean;
}): DaySummary {
  const warnings: string[] = [];
  const d = new Date(input.date + "T00:00:00");
  const dow = d.getDay().toString();
  const slot = input.schedule?.weekly_pattern?.[dow] ?? null;
  const isWeekend = dow === "0" || dow === "6";

  const expected_min = slot ? toMinutes(slot.end) - toMinutes(slot.start) - (slot.break_min ?? 0) : 0;

  // Pair punches into intervals
  const sorted = [...input.punches].sort((a, b) => a.ts.localeCompare(b.ts));
  let worked = 0;
  let night = 0;
  let openIn: Date | null = null;
  let onBreak = false;
  let breakStart: Date | null = null;
  let breakTotal = 0;

  for (const p of sorted) {
    const t = new Date(p.ts);
    if (p.kind === "entrada" && !openIn) openIn = t;
    else if (p.kind === "saida" && openIn) {
      const end = t;
      worked += (end.getTime() - openIn.getTime()) / 60000;
      if (input.schedule?.night_shift_start && input.schedule?.night_shift_end) {
        night += nightOverlapMinutes(openIn, end, input.schedule.night_shift_start, input.schedule.night_shift_end);
      }
      openIn = null;
    } else if (p.kind === "inicio_intervalo" && openIn && !onBreak) {
      // close current and pause
      worked += (t.getTime() - openIn.getTime()) / 60000;
      if (input.schedule?.night_shift_start && input.schedule?.night_shift_end) {
        night += nightOverlapMinutes(openIn, t, input.schedule.night_shift_start, input.schedule.night_shift_end);
      }
      openIn = null;
      onBreak = true;
      breakStart = t;
    } else if (p.kind === "fim_intervalo" && onBreak && breakStart) {
      breakTotal += (t.getTime() - breakStart.getTime()) / 60000;
      onBreak = false;
      breakStart = null;
      openIn = t; // resume work
    }
  }

  if (openIn) warnings.push("Batida de saída ausente");

  worked = Math.max(0, Math.round(worked));
  // Late computation: first 'entrada' vs scheduled start
  let late = 0;
  if (slot && sorted.length > 0) {
    const firstIn = sorted.find((p) => p.kind === "entrada");
    if (firstIn) {
      const sched = new Date(input.date + "T" + slot.start + ":00");
      const diff = (new Date(firstIn.ts).getTime() - sched.getTime()) / 60000;
      const tol = input.schedule?.tolerance_min ?? 0;
      if (diff > tol) late = Math.round(diff);
    } else {
      late = expected_min; // missed entirely
    }
  }

  // Intrajornada
  if (slot && slot.break_min && breakTotal > 0 && breakTotal < (input.schedule?.intrajornada_min ?? 0)) {
    warnings.push(`Intervalo abaixo do mínimo (${Math.round(breakTotal)}min)`);
  }

  // Extras: anything beyond expected counts as 50%. Sundays/holidays = 100%.
  const extra = Math.max(0, worked - expected_min);
  const is100 = input.isHoliday || dow === "0";
  const extra_min_50 = is100 ? 0 : extra;
  const extra_min_100 = is100 ? extra : 0;

  const balance_min = worked - expected_min;

  return {
    date: input.date,
    worked_min: worked,
    expected_min,
    late_min: late,
    extra_min_50,
    extra_min_100,
    night_min: night,
    balance_min,
    is_holiday: input.isHoliday,
    is_weekend: isWeekend,
    is_scheduled: !!slot,
    warnings,
  };
}

export function fmtMin(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${String(m).padStart(2, "0")}`;
}
