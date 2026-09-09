/**
 * Nutrition and dynamic expenditure calculations.
 * Inspired by scientific energy-balance models (Mifflin-St Jeor + dynamic TDEE tracking).
 * Includes Dietary Reference Intakes (DRI / RDA) for vitamins, minerals, and macros.
 */

export const KCAL_PER_KG_FAT = 7700;
export const KCAL_PER_LB_FAT = 3500;
export const TREND_ALPHA = 0.25;

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export const ACTIVITY_LABELS = {
  sedentary: "Sedentary (desk job, little exercise)",
  light: "Light (1-3 workouts/week)",
  moderate: "Moderate (3-5 workouts/week)",
  active: "Active (6-7 workouts/week)",
  veryActive: "Very active (hard training or physical job)",
};

export function lbsToKg(lb) {
  return lb / 2.20462;
}

export function kgToLbs(kg) {
  return kg * 2.20462;
}

/**
 * Computes exponential moving average trend series for weights.
 * Supports array of { date, weight } objects OR object dictionary { [date]: weight }.
 */
export function computeWeightSeries(weightsInput) {
  if (!weightsInput) return [];
  let list = [];
  if (Array.isArray(weightsInput)) {
    list = weightsInput.filter((w) => w && w.date && w.weight !== undefined && w.weight !== null);
  } else if (typeof weightsInput === "object") {
    list = Object.entries(weightsInput).map(([date, weight]) => ({
      date,
      weight: parseFloat(weight) || 0,
    }));
  }
  if (list.length === 0) return [];
  const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let trend = null;
  return sorted.map((w, i) => {
    trend = i === 0 ? w.weight : TREND_ALPHA * w.weight + (1 - TREND_ALPHA) * trend;
    return {
      date: w.date,
      weight: Math.round(w.weight * 10) / 10,
      trend: Math.round(trend * 10) / 10,
    };
  });
}

/**
 * Computes dynamic total daily energy expenditure (TDEE) based on:
 * Intake calories and trend weight changes over a 7-day to 30-day window.
 * Supports both series array or weights object, and entries array or logs dictionary.
 */
export function computeExpenditure(seriesOrWeights, logsOrEntries, unit = "kg") {
  const series = Array.isArray(seriesOrWeights)
    ? seriesOrWeights
    : computeWeightSeries(seriesOrWeights);

  if (!series || series.length < 3) return null;
  const last = series[series.length - 1];
  const targetStartDate = addDays(last.date, -7);

  let anchor = series[0];
  for (const pt of series) {
    if (pt.date <= targetStartDate) anchor = pt;
  }
  const spanDays = daysBetween(anchor.date, last.date);
  if (spanDays < 3) return null;

  const rawChange = last.trend - anchor.trend;
  const weeklyChange = (rawChange * 7) / spanDays;

  // Build daily calories dictionary from either entries array or logs object
  const calByDate = {};
  if (Array.isArray(logsOrEntries)) {
    for (const e of logsOrEntries) {
      if (e && e.date) {
        calByDate[e.date] = (calByDate[e.date] || 0) + (e.calories || 0);
      }
    }
  } else if (logsOrEntries && typeof logsOrEntries === "object") {
    for (const [d, val] of Object.entries(logsOrEntries)) {
      if (Array.isArray(val)) {
        calByDate[d] = val.reduce((s, e) => s + (e.calories || 0), 0);
      } else if (typeof val === "number") {
        calByDate[d] = val;
      }
    }
  }

  let sum = 0;
  let count = 0;
  let d = anchor.date;
  while (d <= last.date) {
    if (calByDate[d] !== undefined) {
      sum += calByDate[d];
      count += 1;
    }
    d = addDays(d, 1);
  }
  if (count < 3) return null;

  const avgIntake = sum / count;
  const kcalPerUnitFat = unit === "lb" || unit === "lbs" ? KCAL_PER_LB_FAT : KCAL_PER_KG_FAT;
  const expenditure = avgIntake - (weeklyChange * kcalPerUnitFat) / 7;

  return {
    expenditure: Math.max(800, Math.round(expenditure)),
    avgIntake: Math.round(avgIntake),
    weeklyChange: Math.round(weeklyChange * 100) / 100,
    days: spanDays,
  };
}

/**
 * Computes calorie target and macro breakdown for a given body goal.
 */
export function computeGoalPlan({
  sex = "male",
  age = 25,
  heightCm = 175,
  currentWeightKg = 72,
  currentBF,
  goalWeightKg = 70,
  goalBF,
  activity = "light",
  timeframeWeeksInput,
  measuredExpenditure,
  useMeasured,
}) {
  if (!age || !heightCm || !currentWeightKg || !goalWeightKg) return null;

  // Mifflin-St Jeor formula
  const bmr =
    sex === "male"
      ? 10 * currentWeightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * currentWeightKg + 6.25 * heightCm - 5 * age - 161;

  const formulaTDEE = bmr * (ACTIVITY_MULTIPLIERS[activity] || 1.375);
  const tdee = useMeasured && measuredExpenditure ? measuredExpenditure : formulaTDEE;

  const weightDiff = goalWeightKg - currentWeightKg;
  const direction = Math.abs(weightDiff) < 0.3 ? "maintain" : weightDiff < 0 ? "lose" : "gain";

  let weeklyRateKg;
  let weeksUsed;
  if (timeframeWeeksInput && timeframeWeeksInput > 0) {
    weeksUsed = timeframeWeeksInput;
    weeklyRateKg = weightDiff / weeksUsed;
  } else if (direction === "maintain") {
    weeklyRateKg = 0;
    weeksUsed = 0;
  } else {
    const safePct = direction === "lose" ? 0.006 : 0.0025; // 0.6% loss or 0.25% gain per week
    weeklyRateKg = direction === "lose" ? -currentWeightKg * safePct : currentWeightKg * safePct;
    weeksUsed = Math.abs(weightDiff / weeklyRateKg);
  }

  let calorieTarget = tdee + (weeklyRateKg * KCAL_PER_KG_FAT) / 7;

  // Lean body mass approximation
  const currentLBM = currentBF ? currentWeightKg * (1 - currentBF / 100) : currentWeightKg * 0.8;
  const goalLBM = goalBF ? goalWeightKg * (1 - goalBF / 100) : goalWeightKg * 0.8;
  const avgLBM = (currentLBM + goalLBM) / 2;

  const proteinPerKgLBM = direction === "lose" ? 2.2 : direction === "gain" ? 1.8 : 2.0;
  const proteinTarget = avgLBM * proteinPerKgLBM;
  const fatTarget = Math.max(currentWeightKg * 0.7, (calorieTarget * 0.25) / 9);

  let warning = null;
  const minSafeCalories = sex === "male" ? 1500 : 1200;
  if (calorieTarget < minSafeCalories) {
    warning = `A ${weeksUsed.toFixed(1)}-week timeframe would put you under ${minSafeCalories} kcal/day, which is too aggressive. Try a longer timeframe — targets below are floored at a safer minimum.`;
    calorieTarget = minSafeCalories;
  }

  let carbTarget = (calorieTarget - proteinTarget * 4 - fatTarget * 9) / 4;
  if (carbTarget < 20) {
    carbTarget = 20;
    if (!warning) {
      warning = "Protein and fat needs leave very little room for carbs at this calorie level — consider a slower pace.";
    }
  }

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
    weeksUsed: Math.round(weeksUsed * 10) / 10,
    calorieTarget: Math.round(calorieTarget),
    proteinTarget: Math.round(proteinTarget),
    fatTarget: Math.round(fatTarget),
    carbTarget: Math.round(carbTarget),
    direction,
    warning,
  };
}

/**
 * Dietary Reference Intakes (DRI / RDA) based on Age, Sex, Calorie Target, and Weight.
 * Follows National Academies of Sciences, Engineering, and Medicine & WHO standards.
 */
export function computeDailyNutrientTargets({
  age = 25,
  sex = "male",
  weightKg = 72,
  calorieTarget = 2400,
}) {
  const parsedAge = parseFloat(age) || 25;
  const isMale = sex === "male";
  const weight = parseFloat(weightKg) || 72;
  const calories = parseFloat(calorieTarget) || 2400;

  // 1. Core Macronutrients
  const proteinTarget = Math.round(weight * 1.8);
  const fatTarget = Math.round((calories * 0.25) / 9);
  const carbTarget = Math.max(50, Math.round((calories - proteinTarget * 4 - fatTarget * 9) / 4));

  // Fiber: 14g per 1,000 kcal (or 38g for young men, 25g for young women)
  const fiberTarget = Math.round(Math.max(isMale ? 38 : 25, (calories / 1000) * 14));

  // Sugar: Recommended max added/free sugar (WHO recommends < 5-10% total calories)
  const maxSugarLimit = isMale ? 36 : 25; // grams

  // Saturated Fat: Recommended max < 10% total calories
  const maxSatFatLimit = Math.round((calories * 0.08) / 9); // grams

  // 2. Essential Vitamins (RDA)
  const vitaminCTarget = parsedAge < 19 ? 75 : isMale ? 90 : 75; // mg
  const vitaminDTarget = parsedAge > 70 ? 800 : 600; // IU
  const vitaminB12Target = 2.4; // mcg
  const vitaminATarget = isMale ? 900 : 700; // mcg

  // 3. Essential Minerals & Electrolytes (RDA / AI)
  const maxSodiumLimit = 2300; // mg (Upper Tolerable Limit)
  const potassiumTarget = isMale ? 3400 : 2600; // mg
  const calciumTarget = (isMale ? parsedAge > 70 : parsedAge > 50) ? 1200 : 1000; // mg
  const ironTarget = isMale ? 8 : parsedAge > 50 ? 8 : 18; // mg
  const magnesiumTarget = isMale ? (parsedAge > 30 ? 420 : 400) : (parsedAge > 30 ? 320 : 310); // mg
  const zincTarget = isMale ? 11 : 8; // mg

  // 4. Hydration (Water): ~3,500 ml (men), ~2,600 ml (women)
  const waterTarget = isMale ? 3500 : 2600; // ml

  return {
    calories: Math.round(calories),
    protein: proteinTarget,
    carbs: carbTarget,
    fat: fatTarget,
    fiber: fiberTarget,
    sugarLimit: maxSugarLimit,
    satFatLimit: maxSatFatLimit,
    vitaminC: vitaminCTarget,
    vitaminD: vitaminDTarget,
    vitaminB12: vitaminB12Target,
    vitaminA: vitaminATarget,
    sodiumLimit: maxSodiumLimit,
    potassium: potassiumTarget,
    calcium: calciumTarget,
    iron: ironTarget,
    magnesium: magnesiumTarget,
    zinc: zincTarget,
    water: waterTarget,
  };
}

/**
 * Evaluates whether intake is Under, Optimal, or Over target/limit.
 */
export function evaluateNutrientStatus(nutrientKey, currentVal, targetVal) {
  const current = currentVal || 0;
  const target = targetVal || 1;
  const pct = Math.round((current / target) * 100);

  // Upper limits (Nutrients where going OVER is undesirable: Sodium, Sugar, Saturated Fat)
  const isLimitNutrient = ["sodiumLimit", "sugarLimit", "satFatLimit"].includes(nutrientKey);

  if (isLimitNutrient) {
    if (current > target) {
      return {
        status: "over",
        label: "Over Limit",
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/30",
        barColor: "#F43F5E",
        diffText: `+${Math.round(current - target)} over limit`,
        pct,
      };
    } else if (current > target * 0.85) {
      return {
        status: "warning",
        label: "Near Limit",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        barColor: "#F59E0B",
        diffText: `${Math.round(target - current)} left until cap`,
        pct,
      };
    } else {
      return {
        status: "optimal",
        label: "Safe Range",
        color: "text-pink-400",
        bg: "bg-pink-500/10",
        border: "border-pink-500/30",
        barColor: "#F43F8E",
        diffText: `${Math.round(target - current)} left`,
        pct,
      };
    }
  }

  // Minimum Targets (Protein, Fiber, Vitamins, Minerals, Water)
  if (pct >= 90 && pct <= 125) {
    return {
      status: "optimal",
      label: "Optimal",
      color: "text-pink-400",
      bg: "bg-pink-500/10",
      border: "border-pink-500/30",
      barColor: "#F43F8E",
      diffText: "Target Achieved",
      pct,
    };
  } else if (pct > 125) {
    return {
      status: "over",
      label: "Surplus",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      barColor: "#22D3EE",
      diffText: `+${Math.round(current - target)} surplus`,
      pct,
    };
  } else if (pct >= 60) {
    return {
      status: "under",
      label: "Moderate",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      barColor: "#F59E0B",
      diffText: `${Math.round(target - current)} needed`,
      pct,
    };
  } else {
    return {
      status: "low",
      label: "Deficit",
      color: "text-slate-400",
      bg: "bg-slate-800/60",
      border: "border-slate-700/60",
      barColor: "#64748B",
      diffText: `${Math.round(target - current)} needed`,
      pct,
    };
  }
}

/* Date utilities */
export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function addDays(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

export function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}

export function formatDateLabel(dateStr) {
  const today = todayStr();
  const yest = addDays(today, -1);
  if (dateStr === today) return "Today";
  if (dateStr === yest) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function fmtShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Computes consecutive active day streak based on logged meals, weigh-ins, and water intake.
 */
export function computeUserStreak(entries = [], weights = {}, waterLogs = {}) {
  const activeDates = new Set();
  if (Array.isArray(entries)) {
    for (const e of entries) {
      if (e && e.date) activeDates.add(e.date);
    }
  }
  if (weights && typeof weights === "object") {
    for (const [date, val] of Object.entries(weights)) {
      if (val !== undefined && val !== null && val > 0) activeDates.add(date);
    }
  }
  if (waterLogs && typeof waterLogs === "object") {
    for (const [date, val] of Object.entries(waterLogs)) {
      if (val && val > 0) activeDates.add(date);
    }
  }

  const today = todayStr();
  const yesterday = addDays(today, -1);

  let currentCheckDate = null;
  if (activeDates.has(today)) {
    currentCheckDate = today;
  } else if (activeDates.has(yesterday)) {
    currentCheckDate = yesterday;
  } else {
    return {
      currentStreak: 0,
      loggedToday: false,
      totalActiveDays: activeDates.size,
    };
  }

  let streak = 0;
  while (activeDates.has(currentCheckDate)) {
    streak++;
    currentCheckDate = addDays(currentCheckDate, -1);
  }

  return {
    currentStreak: streak,
    loggedToday: activeDates.has(today),
    totalActiveDays: activeDates.size,
  };
}
