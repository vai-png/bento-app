import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  X,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Scale,
  TrendingDown,
  TrendingUp,
  Minus,
  Camera,
  ScanLine,
  Loader2,
  AlertCircle,
  Moon,
  Sun,
  Flame,
  Utensils,
  Target,
  Sparkles,
  Download,
  Copy,
  Check,
  Image as ImageIcon,
  Key,
  BarChart2,
  Droplets,
  Heart,
  ShieldCheck,
  AlertTriangle,
  Info,
  FileText,
  Send,
  Calendar,
  User,
  Upload,
  FileUp,
  Database,
  Share2,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import {
  computeGoalPlan,
  computeWeightSeries,
  computeExpenditure,
  computeDailyNutrientTargets,
  evaluateNutrientStatus,
  toDateStr,
  todayStr,
  addDays,
  formatDateLabel,
  fmtShort,
  lbsToKg,
  kgToLbs,
  ACTIVITY_LABELS,
  computeUserStreak,
} from "./utils/nutrition.js";
import { fileToOptimizedImage, fileToBase64, analyzeImage, analyzeTextMeal } from "./utils/visionApi.js";

/* ---------------------------------------------------------------- */
/* Meal Configurations                                               */
/* ---------------------------------------------------------------- */

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const MEAL_CONFIG = {
  Breakfast: { emoji: "🍳", label: "Breakfast" },
  Lunch: { emoji: "🥗", label: "Lunch" },
  Dinner: { emoji: "🍲", label: "Dinner" },
  Snacks: { emoji: "🍎", label: "Snacks" },
};

const DEFAULT_USER_PROFILE = {
  displayName: "Athlete",
  avatar: "",
};

const DEFAULT_SETTINGS = {
  age: 25,
  sex: "male",
  heightCm: 175,
  activity: "light",
  calorieTarget: 2400,
  proteinTarget: 160,
  carbTarget: 240,
  fatTarget: 60,
  unit: "kg",
  apiKey: "",
};

/* ---------------------------------------------------------------- */
/* UI: Calorie Hero Ring Card                                       */
/* ---------------------------------------------------------------- */

function CalorieHeroCard({ totals, target, activeBurn }) {
  const circumference = 251.2; // 2 * PI * 40
  const totalCals = totals.calories || 0;
  const remaining = target - totalCals;
  const isOver = remaining < 0;
  const pct = Math.min(100, Math.round((totalCals / (target || 1)) * 100));

  const fraction = Math.min(1, Math.max(0, totalCals / (target || 1)));
  const strokeDashoffset = circumference - fraction * circumference;

  return (
    <div
      className="bento-card rounded-3xl p-5 sm:p-6 relative overflow-hidden transition-all duration-300"
      style={{
        borderColor: isOver ? "var(--c-macro-fat-border)" : "var(--c-macro-cal-border)",
      }}
    >
      {/* Subtle ambient corner glow */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-30"
        style={{
          backgroundColor: isOver ? "var(--c-macro-fat)" : "var(--c-macro-cal)",
        }}
      />

      {/* Header bar with badge */}
      <div className="flex items-center justify-between text-xs mb-3">
        <span
          className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5"
          style={{ color: isOver ? "var(--c-macro-fat)" : "var(--c-macro-cal)" }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: isOver ? "var(--c-macro-fat)" : "var(--c-macro-cal)" }}
          />
          Daily Energy Target
        </span>
        <span
          className="text-[10px] font-black px-2.5 py-0.5 rounded-full border"
          style={{
            backgroundColor: isOver ? "var(--c-macro-fat-dim)" : "var(--c-macro-cal-dim)",
            color: isOver ? "var(--c-macro-fat)" : "var(--c-macro-cal)",
            borderColor: isOver ? "var(--c-macro-fat-border)" : "var(--c-macro-cal-border)",
          }}
        >
          {pct}% Consumed
        </span>
      </div>

      <div className="flex items-center justify-center gap-4 sm:gap-6 py-1">
        {/* SVG Ring Gauge */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="var(--c-ring-track)"
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke={isOver ? "var(--c-macro-fat)" : "var(--c-macro-cal)"}
              strokeWidth="8"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Inner Stat */}
          <div className="absolute text-center select-none">
            <span
              className="text-3xl sm:text-4xl font-black tracking-tight"
              style={{ color: isOver ? "var(--c-macro-fat)" : "var(--c-macro-cal)" }}
            >
              {Math.abs(Math.round(remaining)).toLocaleString()}
            </span>
            <span
              className="block text-[10px] font-bold uppercase tracking-wider mt-0.5"
              style={{ color: "var(--c-ink-dim)" }}
            >
              {isOver ? "Kcal Over" : "Kcal Left"}
            </span>
          </div>
        </div>

        {/* Side Metrics Tiles */}
        <div className="space-y-2 flex-1 min-w-0">
          <div
            className="p-2 sm:p-2.5 rounded-2xl border transition"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "var(--c-line)",
            }}
          >
            <div className="text-[10px] font-bold uppercase" style={{ color: "var(--c-ink-dim)" }}>
              Budget Goal
            </div>
            <div className="text-sm sm:text-base font-black mt-0.5" style={{ color: "var(--c-ink)" }}>
              {Math.round(target).toLocaleString()} <span className="text-[10px] font-normal" style={{ color: "var(--c-ink-dim)" }}>kcal</span>
            </div>
          </div>

          <div
            className="p-2 sm:p-2.5 rounded-2xl border transition"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "var(--c-line)",
            }}
          >
            <div className="text-[10px] font-bold uppercase" style={{ color: "var(--c-ink-dim)" }}>
              Food Eaten
            </div>
            <div className="text-sm sm:text-base font-black mt-0.5" style={{ color: "var(--c-macro-cal)" }}>
              {Math.round(totalCals).toLocaleString()} <span className="text-[10px] font-normal" style={{ color: "var(--c-ink-dim)" }}>kcal</span>
            </div>
          </div>

          <div
            className="p-2 sm:p-2.5 rounded-2xl border transition"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "var(--c-line)",
            }}
          >
            <div className="text-[10px] font-bold uppercase" style={{ color: "var(--c-ink-dim)" }}>
              Active Burn
            </div>
            <div className="text-sm sm:text-base font-black mt-0.5 text-orange-400">
              {activeBurn.toLocaleString()} <span className="text-[10px] font-normal" style={{ color: "var(--c-ink-dim)" }}>kcal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* UI: Macronutrients Card (Bento Performance 3-Tile Grid)          */
/* ---------------------------------------------------------------- */

function MacronutrientsCard({ totals, settings }) {
  const proteinTarget = settings.proteinTarget || 150;
  const carbTarget = settings.carbTarget || 220;
  const fatTarget = settings.fatTarget || 65;

  const proteinVal = Math.round(totals.protein || 0);
  const carbVal = Math.round(totals.carbs || 0);
  const fatVal = Math.round(totals.fat || 0);

  const proteinPct = Math.min(100, Math.round((proteinVal / proteinTarget) * 100));
  const carbsPct = Math.min(100, Math.round((carbVal / carbTarget) * 100));
  const fatPct = Math.min(100, Math.round((fatVal / fatTarget) * 100));

  const proteinLeft = Math.max(0, Math.round(proteinTarget - proteinVal));
  const carbLeft = Math.max(0, Math.round(carbTarget - carbVal));
  const fatLeft = Math.max(0, Math.round(fatTarget - fatVal));

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline px-1">
        <h2
          className="text-xs font-black tracking-wider uppercase"
          style={{ color: "var(--c-ink-dim)" }}
        >
          Macronutrients
        </h2>
        <span className="text-[10px] font-mono font-bold text-violet-400">
          Target: {Math.round(proteinTarget)}P · {Math.round(carbTarget)}C · {Math.round(fatTarget)}F
        </span>
      </div>

      {/* 3-Column Bento Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {/* 1. Protein Tile (Electric Violet) */}
        <div
          className="bento-card rounded-2xl p-3 sm:p-3.5 space-y-2 relative overflow-hidden transition-all duration-200"
          style={{
            borderColor: "var(--c-macro-pro-border)",
          }}
        >
          <div className="flex items-center justify-between text-[10px] font-black uppercase">
            <span style={{ color: "var(--c-macro-pro)" }}>Protein</span>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold"
              style={{
                backgroundColor: "var(--c-macro-pro-dim)",
                color: "var(--c-macro-pro)",
              }}
            >
              {proteinPct}%
            </span>
          </div>

          <div>
            <div className="text-lg sm:text-xl font-black leading-tight" style={{ color: "var(--c-ink)" }}>
              {proteinVal}<span className="text-xs font-semibold" style={{ color: "var(--c-ink-dim)" }}>g</span>
            </div>
            <div className="text-[10px] font-medium truncate mt-0.5" style={{ color: "var(--c-ink-dim)" }}>
              {proteinLeft > 0 ? `${proteinLeft}g left` : "Goal Met ✓"}
            </div>
          </div>

          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--c-ring-track)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${proteinPct}%`,
                backgroundColor: "var(--c-macro-pro)",
              }}
            />
          </div>
        </div>

        {/* 2. Carbs Tile (Citrus Amber) */}
        <div
          className="bento-card rounded-2xl p-3 sm:p-3.5 space-y-2 relative overflow-hidden transition-all duration-200"
          style={{
            borderColor: "var(--c-macro-carb-border)",
          }}
        >
          <div className="flex items-center justify-between text-[10px] font-black uppercase">
            <span style={{ color: "var(--c-macro-carb)" }}>Carbs</span>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold"
              style={{
                backgroundColor: "var(--c-macro-carb-dim)",
                color: "var(--c-macro-carb)",
              }}
            >
              {carbsPct}%
            </span>
          </div>

          <div>
            <div className="text-lg sm:text-xl font-black leading-tight" style={{ color: "var(--c-ink)" }}>
              {carbVal}<span className="text-xs font-semibold" style={{ color: "var(--c-ink-dim)" }}>g</span>
            </div>
            <div className="text-[10px] font-medium truncate mt-0.5" style={{ color: "var(--c-ink-dim)" }}>
              {carbLeft > 0 ? `${carbLeft}g left` : "Goal Met ✓"}
            </div>
          </div>

          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--c-ring-track)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${carbsPct}%`,
                backgroundColor: "var(--c-macro-carb)",
              }}
            />
          </div>
        </div>

        {/* 3. Fats Tile (Coral Rose) */}
        <div
          className="bento-card rounded-2xl p-3 sm:p-3.5 space-y-2 relative overflow-hidden transition-all duration-200"
          style={{
            borderColor: "var(--c-macro-fat-border)",
          }}
        >
          <div className="flex items-center justify-between text-[10px] font-black uppercase">
            <span style={{ color: "var(--c-macro-fat)" }}>Fats</span>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold"
              style={{
                backgroundColor: "var(--c-macro-fat-dim)",
                color: "var(--c-macro-fat)",
              }}
            >
              {fatPct}%
            </span>
          </div>

          <div>
            <div className="text-lg sm:text-xl font-black leading-tight" style={{ color: "var(--c-ink)" }}>
              {fatVal}<span className="text-xs font-semibold" style={{ color: "var(--c-ink-dim)" }}>g</span>
            </div>
            <div className="text-[10px] font-medium truncate mt-0.5" style={{ color: "var(--c-ink-dim)" }}>
              {fatLeft > 0 ? `${fatLeft}g left` : "Goal Met ✓"}
            </div>
          </div>

          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--c-ring-track)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${fatPct}%`,
                backgroundColor: "var(--c-macro-fat)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* UI: Daily Nutrition & Micronutrient Summary Card                 */
/* ---------------------------------------------------------------- */

function MicronutrientSummaryCard({
  totals,
  targets,
  waterMl,
  onAddWater,
  onOpenDetails,
}) {
  const fiberEval = evaluateNutrientStatus("fiber", totals.fiber, targets.fiber);
  const sodiumEval = evaluateNutrientStatus("sodiumLimit", totals.sodium, targets.sodiumLimit);
  const sugarEval = evaluateNutrientStatus("sugarLimit", totals.sugar, targets.sugarLimit);
  const vitCEval = evaluateNutrientStatus("vitaminC", totals.vitaminC, targets.vitaminC);

  const waterPct = Math.min(100, Math.round((waterMl / (targets.water || 3000)) * 100));

  return (
    <div className="bento-card rounded-3xl p-5 space-y-4 transition-all duration-300">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5"
            style={{ color: "var(--c-ink)" }}
          >
            <Heart size={14} className="text-pink-500 shrink-0" /> Micronutrients & Health
          </h2>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--c-ink-dim)" }}>
            Profile DRI ({targets.calories} kcal)
          </p>
        </div>
        <button
          onClick={onOpenDetails}
          className="text-xs font-bold text-pink-400 hover:underline shrink-0 whitespace-nowrap pt-0.5"
        >
          Full Report →
        </button>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Fiber */}
        <div className={`p-2.5 rounded-2xl border ${fiberEval.border} ${fiberEval.bg}`}>
          <div className="flex justify-between items-center">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--c-ink-dim)" }}
            >
              Dietary Fiber
            </span>
            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${fiberEval.color}`}>
              {fiberEval.label}
            </span>
          </div>
          <div className="text-sm font-extrabold mt-1" style={{ color: "var(--c-ink)" }}>
            {Math.round(totals.fiber)}g{" "}
            <span className="text-[10px] font-normal" style={{ color: "var(--c-ink-dim)" }}>
              / {targets.fiber}g
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--c-ink-dim)" }}>{fiberEval.diffText}</p>
        </div>

        {/* Sodium */}
        <div className={`p-2.5 rounded-2xl border ${sodiumEval.border} ${sodiumEval.bg}`}>
          <div className="flex justify-between items-center">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--c-ink-dim)" }}
            >
              Sodium
            </span>
            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${sodiumEval.color}`}>
              {sodiumEval.label}
            </span>
          </div>
          <div className="text-sm font-extrabold mt-1" style={{ color: "var(--c-ink)" }}>
            {Math.round(totals.sodium)}mg{" "}
            <span className="text-[10px] font-normal" style={{ color: "var(--c-ink-dim)" }}>
              / {targets.sodiumLimit}mg
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--c-ink-dim)" }}>{sodiumEval.diffText}</p>
        </div>

        {/* Sugar */}
        <div className={`p-2.5 rounded-2xl border ${sugarEval.border} ${sugarEval.bg}`}>
          <div className="flex justify-between items-center">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--c-ink-dim)" }}
            >
              Added Sugar
            </span>
            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${sugarEval.color}`}>
              {sugarEval.label}
            </span>
          </div>
          <div className="text-sm font-extrabold mt-1" style={{ color: "var(--c-ink)" }}>
            {Math.round(totals.sugar)}g{" "}
            <span className="text-[10px] font-normal" style={{ color: "var(--c-ink-dim)" }}>
              / {targets.sugarLimit}g
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--c-ink-dim)" }}>{sugarEval.diffText}</p>
        </div>

        {/* Vitamin C */}
        <div className={`p-2.5 rounded-2xl border ${vitCEval.border} ${vitCEval.bg}`}>
          <div className="flex justify-between items-center">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--c-ink-dim)" }}
            >
              Vitamin C
            </span>
            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${vitCEval.color}`}>
              {vitCEval.label}
            </span>
          </div>
          <div className="text-sm font-extrabold mt-1" style={{ color: "var(--c-ink)" }}>
            {Math.round(totals.vitaminC)}mg{" "}
            <span className="text-[10px] font-normal" style={{ color: "var(--c-ink-dim)" }}>
              / {targets.vitaminC}mg
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--c-ink-dim)" }}>{vitCEval.diffText}</p>
        </div>
      </div>

      {/* Water Hydration Quick Tracker */}
      <div
        className="p-3 rounded-2xl border flex items-center justify-between transition-colors duration-200"
        style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-500 shrink-0">
            <Droplets size={16} />
          </div>
          <div className="min-w-0">
            <div
              className="text-xs font-bold flex items-center gap-1.5"
              style={{ color: "var(--c-ink)" }}
            >
              <span>Hydration Tracker</span>
              <span className="text-[10px] text-cyan-500 font-semibold">({waterPct}%)</span>
            </div>
            <div className="text-[11px]" style={{ color: "var(--c-ink-dim)" }}>
              {waterMl} / {targets.water} ml ({Math.round(waterMl / 250)} glasses)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onAddWater(250)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-white shadow-sm transition active:scale-95"
          >
            +250ml
          </button>
          <button
            onClick={() => onAddWater(500)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95"
            style={{
              backgroundColor: "var(--c-card-solid)",
              borderColor: "var(--c-line)",
              color: "var(--c-ink)",
            }}
          >
            +500ml
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* UI: Full Micronutrient & Health Breakdown Window Modal           */
/* ---------------------------------------------------------------- */

function NutrientBreakdownContent({ totals, targets, age, sex, waterMl, onAddWater }) {
  const waterPct = Math.min(100, Math.round(((waterMl || 0) / (targets.water || 3000)) * 100));

  const categories = [
    {
      title: "Macronutrients & Fiber",
      items: [
        {
          key: "protein",
          name: "Protein",
          current: totals.protein,
          target: targets.protein,
          unit: "g",
          desc: "Muscle protein synthesis & cellular repair",
        },
        {
          key: "carbs",
          name: "Carbohydrates",
          current: totals.carbs,
          target: targets.carbs,
          unit: "g",
          desc: "Primary cellular energy & brain glycogen",
        },
        {
          key: "fiber",
          name: "Dietary Fiber",
          current: totals.fiber,
          target: targets.fiber,
          unit: "g",
          desc: "Digestive motility, gut microbiome & glucose control",
        },
        {
          key: "fat",
          name: "Total Fats",
          current: totals.fat,
          target: targets.fat,
          unit: "g",
          desc: "Hormone synthesis & nutrient absorption",
        },
        {
          key: "satFatLimit",
          name: "Saturated Fat",
          current: totals.satFat,
          target: targets.satFatLimit,
          unit: "g",
          desc: "Recommended upper threshold (<10% total calories)",
        },
        {
          key: "sugarLimit",
          name: "Added Sugar",
          current: totals.sugar,
          target: targets.sugarLimit,
          unit: "g",
          desc: "Recommended cap for metabolic health (<5-10%)",
        },
      ],
    },
    {
      title: "Essential Vitamins",
      items: [
        {
          key: "vitaminA",
          name: "Vitamin A",
          current: totals.vitaminA,
          target: targets.vitaminA,
          unit: "mcg",
          desc: "Vision, epithelial cell integrity & immune defense",
        },
        {
          key: "vitaminC",
          name: "Vitamin C",
          current: totals.vitaminC,
          target: targets.vitaminC,
          unit: "mg",
          desc: "Collagen synthesis & antioxidant scavenger",
        },
        {
          key: "vitaminD",
          name: "Vitamin D",
          current: totals.vitaminD,
          target: targets.vitaminD,
          unit: "mcg",
          desc: "Bone mineralization & endocrine homeostasis",
        },
        {
          key: "vitaminE",
          name: "Vitamin E",
          current: totals.vitaminE,
          target: targets.vitaminE,
          unit: "mg",
          desc: "Lipid membrane antioxidant protection",
        },
        {
          key: "vitaminB6",
          name: "Vitamin B6",
          current: totals.vitaminB6,
          target: targets.vitaminB6,
          unit: "mg",
          desc: "Amino acid metabolism & neurotransmitter synthesis",
        },
        {
          key: "vitaminB12",
          name: "Vitamin B12",
          current: totals.vitaminB12,
          target: targets.vitaminB12,
          unit: "mcg",
          desc: "Red blood cell formation & neurological health",
        },
        {
          key: "folate",
          name: "Folate (B9)",
          current: totals.folate,
          target: targets.folate,
          unit: "mcg",
          desc: "DNA synthesis & cellular division",
        },
      ],
    },
    {
      title: "Key Minerals & Electrolytes",
      items: [
        {
          key: "calcium",
          name: "Calcium",
          current: totals.calcium,
          target: targets.calcium,
          unit: "mg",
          desc: "Skeletal structure & vascular contraction",
        },
        {
          key: "iron",
          name: "Iron",
          current: totals.iron,
          target: targets.iron,
          unit: "mg",
          desc: "Hemoglobin oxygen transport & cellular bioenergetics",
        },
        {
          key: "magnesium",
          name: "Magnesium",
          current: totals.magnesium,
          target: targets.magnesium,
          unit: "mg",
          desc: "300+ enzymatic reactions, ATP synthesis & nerve signaling",
        },
        {
          key: "potassium",
          name: "Potassium",
          current: totals.potassium,
          target: targets.potassium,
          unit: "mg",
          desc: "Cellular fluid balance, blood pressure & muscle contractions",
        },
        {
          key: "sodiumLimit",
          name: "Sodium",
          current: totals.sodium,
          target: targets.sodiumLimit,
          unit: "mg",
          desc: "Electrolyte homeostasis (<2,300mg cardiovascular limit)",
        },
        {
          key: "zinc",
          name: "Zinc",
          current: totals.zinc,
          target: targets.zinc,
          unit: "mg",
          desc: "Immune competence, DNA repair & enzymatic function",
        },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Daily Hydration Quick Tracker Tile */}
      {waterMl !== undefined && onAddWater && (
        <div
          className="bento-card rounded-2xl p-4 space-y-3 transition-colors duration-200"
          style={{ borderColor: "rgba(14, 165, 233, 0.3)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Droplets size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--c-ink)" }}>
                  Daily Hydration
                </h3>
                <p className="text-[10px]" style={{ color: "var(--c-ink-dim)" }}>
                  {waterMl} / {targets.water || 3000} ml ({Math.round(waterMl / 250)} glasses)
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-black text-cyan-400">
              {waterPct}%
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--c-ring-track)" }}>
            <div
              className="h-full rounded-full bg-cyan-500 transition-all duration-500"
              style={{ width: `${waterPct}%` }}
            />
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={() => onAddWater(250)}
              className="flex-1 py-2 rounded-xl text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-sm transition active:scale-95"
            >
              +250ml Glass
            </button>
            <button
              onClick={() => onAddWater(500)}
              className="flex-1 py-2 rounded-xl text-xs font-black border transition active:scale-95"
              style={{
                backgroundColor: "var(--c-card2)",
                borderColor: "var(--c-line)",
                color: "var(--c-ink)",
              }}
            >
              +500ml Bottle
            </button>
          </div>
        </div>
      )}

      {/* 2. Profile DRI Banner */}
      <div
        className="bento-card rounded-2xl p-3.5 border flex items-start gap-2.5"
        style={{ borderColor: "rgba(244, 63, 142, 0.25)" }}
      >
        <Info size={16} className="text-pink-400 mt-0.5 shrink-0" />
        <div className="text-xs" style={{ color: "var(--c-ink)" }}>
          <span className="font-bold">Daily Recommended Intakes (DRI):</span>{" "}
          Personalized for a <strong className="text-pink-400 font-black">{age} year old {sex}</strong>{" "}
          based on WHO & National Academy of Medicine guidelines ({targets.calories} kcal).
        </div>
      </div>

      {/* 3. Nutrient Category Blocks */}
      {categories.map((cat) => (
        <div key={cat.title} className="bento-card rounded-2xl p-4 space-y-3">
          <h3
            className="text-xs font-black uppercase tracking-wider"
            style={{ color: "var(--c-ink-dim)" }}
          >
            {cat.title}
          </h3>
          <div className="space-y-2">
            {cat.items.map((item) => {
              const evalResult = evaluateNutrientStatus(item.key, item.current, item.target);
              const progressWidth = Math.min(100, evalResult.pct);

              return (
                <div
                  key={item.name}
                  className="p-3 rounded-xl border space-y-1.5 transition-colors duration-200"
                  style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold" style={{ color: "var(--c-ink)" }}>
                        {item.name}
                      </span>
                      <p className="text-[10px]" style={{ color: "var(--c-ink-dim)" }}>
                        {item.desc}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${evalResult.bg} ${evalResult.color} border ${evalResult.border}`}>
                        {evalResult.label}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div
                    className="h-1.5 w-full rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--c-ring-track)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progressWidth}%`,
                        backgroundColor: evalResult.barColor,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold" style={{ color: "var(--c-ink)" }}>
                      {Math.round(item.current || 0)} {item.unit}{" "}
                      <span className="font-normal" style={{ color: "var(--c-ink-dim)" }}>
                        / {item.target} {item.unit}
                      </span>
                    </span>
                    <span className={`text-[10px] font-bold ${evalResult.color}`}>
                      {evalResult.diffText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function NutrientBreakdownModal({ totals, targets, age, sex, waterMl, onAddWater, onClose }) {
  return (
    <ModalShell title="Complete Nutritional Breakdown" onClose={onClose}>
      <NutrientBreakdownContent
        totals={totals}
        targets={targets}
        age={age}
        sex={sex}
        waterMl={waterMl}
        onAddWater={onAddWater}
      />
    </ModalShell>
  );
}

/* ---------------------------------------------------------------- */
/* UI: Modal Shell                                                  */
/* ---------------------------------------------------------------- */

function ModalShell({ title, onClose, children }) {
  return (
    <div
      style={{ background: "var(--c-modal-overlay)" }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-md transition-all duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 border"
        style={{
          backgroundColor: "var(--c-modal-card)",
          borderColor: "var(--c-line)",
          color: "var(--c-ink)",
          paddingBottom: "max(var(--sab, 0px), 1rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden"
          style={{ backgroundColor: "var(--c-line)" }}
        />

        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
          style={{
            backgroundColor: "var(--c-modal-card)",
            borderBottomColor: "var(--c-line)",
          }}
        >
          <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--c-ink)" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition-colors"
            style={{ color: "var(--c-ink-dim)" }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto" style={{ color: "var(--c-ink)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function TextField({ label, ...props }) {
  return (
    <label className="block mb-3.5">
      <span
        className="text-[11px] font-bold uppercase tracking-wider"
        style={{ color: "var(--c-ink-dim)" }}
      >
        {label}
      </span>
      <input
        {...props}
        className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-pink-500 transition-all shadow-sm"
        style={{
          backgroundColor: "var(--c-input-bg)",
          borderColor: "var(--c-input-border)",
          color: "var(--c-input-text)",
        }}
      />
    </label>
  );
}

function NumField({ label, value, onChange, unit }) {
  return (
    <label className="block">
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: "var(--c-ink-dim)" }}
      >
        {label}
        {unit ? ` (${unit})` : ""}
      </span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-pink-500 transition-all shadow-sm"
        style={{
          backgroundColor: "var(--c-input-bg)",
          borderColor: "var(--c-input-border)",
          color: "var(--c-input-text)",
        }}
      />
    </label>
  );
}

/* ---------------------------------------------------------------- */
/* Dedicated Weight & Expenditure Window Modal                       */
/* ---------------------------------------------------------------- */

function WeightExpenditureContent({
  unit,
  defaultDate,
  weights,
  weightSeries,
  expenditure,
  onSaveWeight,
  onDeleteWeight,
}) {
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(defaultDate || todayStr());
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  const chartData = useMemo(() => {
    return (weightSeries || []).map((p) => ({
      date: p.date,
      trend: p.trend !== null ? (unit === "lbs" ? kgToLbs(p.trend) : p.trend) : null,
      weight: p.weight !== null ? (unit === "lbs" ? kgToLbs(p.weight) : p.weight) : null,
    }));
  }, [weightSeries, unit]);

  const lastWeight = useMemo(() => {
    if (!weightSeries || weightSeries.length === 0) return null;
    const sorted = [...weightSeries].filter((w) => w.weight !== null).reverse();
    if (sorted.length === 0) return null;
    const raw = sorted[0];
    return {
      weight: unit === "lbs" ? kgToLbs(raw.weight) : raw.weight,
      trend: raw.trend !== null ? (unit === "lbs" ? kgToLbs(raw.trend) : raw.trend) : "—",
      date: raw.date,
    };
  }, [weightSeries, unit]);

  function handleSubmit(e) {
    e.preventDefault();
    const val = parseFloat(weight);
    if (!val || val <= 0) return;
    const kg = unit === "lbs" ? lbsToKg(val) : val;
    onSaveWeight(date, kg);
    setWeight("");
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2500);
  }

  return (
    <div className="space-y-4">
        {/* 1. Quick Log Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-2xl border space-y-3"
          style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: "var(--c-ink)" }}
            >
              <Scale size={14} className="text-pink-500" /> Log Scale Weight
            </span>
            {isSavedNotice && (
              <span className="text-[11px] font-bold text-pink-500 flex items-center gap-1 animate-pulse">
                <Check size={13} /> Saved!
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <TextField
              label="Date"
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
            />
            <TextField
              label={`Weight (${unit})`}
              type="number"
              step="0.1"
              autoFocus
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 74.5"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-pink-500 hover:bg-pink-400 text-slate-950 shadow-md transition-all active:scale-95"
          >
            Save Weight Entry
          </button>
        </form>

        {/* 2. Interactive Area Chart */}
        <div
          className="p-4 rounded-2xl border space-y-2"
          style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--c-ink-dim)" }}
            >
              Weight Trend
            </span>
            <span className="text-[11px]" style={{ color: "var(--c-ink-dim)" }}>
              Last 30 Days
            </span>
          </div>

          {chartData.length > 0 ? (
            <div style={{ height: 160 }} className="w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="modalPinkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F8E" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F43F8E" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--c-line)" vertical={false} opacity={0.6} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtShort}
                    tick={{ fontSize: 9, fill: "var(--c-ink-dim)" }}
                    axisLine={{ stroke: "var(--c-line)" }}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "var(--c-ink-dim)" }}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    formatter={(v, name) => [v, name === "weight" ? "Scale" : "Trend"]}
                    labelFormatter={fmtShort}
                    contentStyle={{
                      background: "var(--c-modal-card)",
                      borderColor: "var(--c-line)",
                      borderRadius: 12,
                      fontSize: 11,
                      color: "var(--c-ink)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="trend"
                    stroke="#F43F8E"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#modalPinkGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="transparent"
                    dot={{ r: 2.5, fill: "#64748B" }}
                    activeDot={{ r: 4, fill: "#F43F8E" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs py-6 text-center" style={{ color: "var(--c-ink-dim)" }}>
              Log your scale weight to display your trend line.
            </p>
          )}

          {/* Metric Badges */}
          <div
            className="grid grid-cols-2 gap-2 pt-2 border-t"
            style={{ borderColor: "var(--c-line)" }}
          >
            <div
              className="p-2.5 rounded-xl border"
              style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--c-ink-dim)" }}
              >
                Trend Weight
              </div>
              <div className="text-base font-extrabold mt-0.5" style={{ color: "var(--c-ink)" }}>
                {lastWeight ? `${lastWeight.trend} ${unit}` : "—"}
              </div>
              {expenditure && (
                <div
                  className={`flex items-center gap-1 text-[10px] font-bold mt-0.5 ${
                    expenditure.weeklyChange < 0 ? "text-pink-500" : "text-rose-500"
                  }`}
                >
                  {expenditure.weeklyChange < 0 ? (
                    <TrendingDown size={12} />
                  ) : (
                    <TrendingUp size={12} />
                  )}
                  {expenditure.weeklyChange > 0 ? "+" : ""}
                  {expenditure.weeklyChange} {unit}/wk
                </div>
              )}
            </div>

            <div
              className="p-2.5 rounded-xl border"
              style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--c-ink-dim)" }}
              >
                Metabolic TDEE
              </div>
              <div className="text-base font-extrabold mt-0.5" style={{ color: "var(--c-ink)" }}>
                {expenditure ? `${expenditure.expenditure} kcal` : "Calibrating..."}
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--c-ink-dim)" }}>
                {expenditure ? "Adaptive expenditure" : "Need 3+ scale logs"}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Weight Log History */}
        <div
          className="p-4 rounded-2xl border space-y-2"
          style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
        >
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: "var(--c-ink-dim)" }}
          >
            Logged Weights
          </span>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {Object.keys(weights).length === 0 ? (
              <p className="text-xs py-3 text-center" style={{ color: "var(--c-ink-dim)" }}>
                No weight logs recorded yet.
              </p>
            ) : (
              Object.entries(weights)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([d, kg]) => {
                  const displayWeight = unit === "lbs" ? kgToLbs(kg) : kg;
                  return (
                    <div
                      key={d}
                      className="flex items-center justify-between p-2 rounded-xl border text-xs"
                      style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
                    >
                      <div>
                        <span className="font-bold" style={{ color: "var(--c-ink)" }}>
                          {displayWeight} {unit}
                        </span>
                        <span className="ml-2 font-medium" style={{ color: "var(--c-ink-dim)" }}>
                          {formatDateLabel(d)}
                        </span>
                      </div>
                      <button
                        onClick={() => onDeleteWeight(d)}
                        className="text-rose-400 hover:text-rose-500 p-1 rounded transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
  );
}

function WeightExpenditureModal({
  unit,
  defaultDate,
  weights,
  weightSeries,
  expenditure,
  onSaveWeight,
  onDeleteWeight,
  onClose,
}) {
  return (
    <ModalShell title="Weight & Expenditure" onClose={onClose}>
      <WeightExpenditureContent
        unit={unit}
        defaultDate={defaultDate}
        weights={weights}
        weightSeries={weightSeries}
        expenditure={expenditure}
        onSaveWeight={onSaveWeight}
        onDeleteWeight={onDeleteWeight}
      />
    </ModalShell>
  );
}



/* ---------------------------------------------------------------- */
/* Add Food Modal with AI Describe, Photo AI, Scanner & Library      */
/* ---------------------------------------------------------------- */

function TabBar({ tab, setTab }) {
  const tabs = [
    { id: "text", label: "AI Describe", icon: Sparkles },
    { id: "photo", label: "Photo AI", icon: Camera },
    { id: "label", label: "Scan Label", icon: ScanLine },
    { id: "search", label: "Library", icon: Utensils },
    { id: "new", label: "Custom", icon: Plus },
  ];
  return (
    <div
      className="flex gap-1 p-1 rounded-2xl mb-4 border overflow-x-auto"
      style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              active
                ? "shadow-sm border font-extrabold"
                : "hover:opacity-100"
            }`}
            style={{
              backgroundColor: active ? "var(--c-card-solid)" : "transparent",
              borderColor: active ? "var(--c-line)" : "transparent",
              color: active ? "var(--c-ink)" : "var(--c-ink-dim)",
            }}
          >
            {Icon && <Icon size={14} className={active ? "text-pink-500" : ""} />} {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Natural Language Food Logger Tab:
 * User describes what they ate in plain English.
 * Works with Gemini/Claude or offline smart heuristic engine.
 */
function TextMealTab({ apiKey, onDone, onClose }) {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("idle"); // idle | analyzing | done | error
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);
  const [servings, setServings] = useState(1);
  const [showMicros, setShowMicros] = useState(false);

  const samplePrompts = [
    "150g grilled chicken + 200g white rice",
    "200g paneer bhurji + 2 rotis + 100g curd",
    "60g oats + 250ml milk + 1 scoop (30g) whey",
    "2 rotis with 1 bowl dal tadka and bhindi masala",
    "4 boiled eggs + 2 slices toast + 10g butter",
    "300g chicken biryani with 100g raita",
    "2 aloo parathas with 150g dahi and 1 tbsp butter",
    "2 tbsp peanut butter + 1 banana + 250ml milk",
    "2 masala dosas with sambhar & coconut chutney",
  ];

  async function handleAnalyze(textToAnalyze) {
    const query = (textToAnalyze || description).trim();
    if (!query) return;
    setStatus("analyzing");
    setResult(null);
    setErrorMessage("");

    try {
      const parsed = await analyzeTextMeal(query, apiKey);
      setResult(parsed);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Failed to estimate meal nutrition.");
    }
  }

  function updateField(field, value) {
    setResult((r) => ({ ...r, [field]: value }));
  }

  function confirmLog() {
    if (!result) return;
    const foodData = {
      name: result.name || description.slice(0, 40) || "Logged Meal",
      servingLabel: result.servingLabel || "1 serving",
      calories: Math.round(result.calories || 0),
      protein: Math.round((result.protein || 0) * 10) / 10,
      carbs: Math.round((result.carbs || 0) * 10) / 10,
      fat: Math.round((result.fat || 0) * 10) / 10,
      fiber: Math.round((result.fiber || 0) * 10) / 10,
      sugar: Math.round((result.sugar || 0) * 10) / 10,
      sodium: Math.round(result.sodium || 0),
      potassium: Math.round(result.potassium || 0),
      calcium: Math.round(result.calcium || 0),
      iron: Math.round((result.iron || 0) * 10) / 10,
      vitaminC: Math.round(result.vitaminC || 0),
    };
    onDone(foodData, servings);
    onClose();
  }

  return (
    <div className="space-y-4">
      {/* Online / Offline Status Badge */}
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          {apiKey ? (
            <span className="text-pink-500 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" /> AI Online (Gemini/Claude)
            </span>
          ) : (
            <span className="text-amber-500 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Smart Heuristic Mode (Offline)
            </span>
          )}
        </span>
        <span className="text-[10px] font-bold text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
          🇮🇳 Indian Meals Supported
        </span>
      </div>

      {/* Description Textarea */}
      <div>
        <label className="block">
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--c-ink-dim)" }}
            >
              What did you eat or drink?
            </span>
            <span className="text-[10px] font-semibold text-pink-500">
              ⚖️ Gram & quantity scaling
            </span>
          </div>
          <textarea
            rows={3}
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 150g grilled chicken with 200g white rice, or 250g paneer bhurji with 2 rotis, or 60g oats with 250ml milk and 1 scoop whey..."
            className="w-full mt-1.5 p-3 rounded-2xl border text-sm outline-none focus:ring-2 focus:ring-pink-500 transition-all resize-none shadow-sm"
            style={{
              backgroundColor: "var(--c-input-bg)",
              borderColor: "var(--c-input-border)",
              color: "var(--c-input-text)",
            }}
          />
        </label>
        <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: "var(--c-ink-dim)" }}>
          <span>Supports: <strong className="text-pink-500">grams (g)</strong>, <strong className="text-pink-500">ml</strong>, spoons, scoops, katoris & counts</span>
          <span className="font-mono opacity-80">e.g. "200g" or "(200g)"</span>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="mt-2.5 space-y-1">
          <p className="text-[10px] font-semibold" style={{ color: "var(--c-ink-dim)" }}>
            Quick prompt ideas:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setDescription(prompt);
                  handleAnalyze(prompt);
                }}
                className="text-[10px] font-medium px-2 py-1 rounded-lg border transition active:scale-95 text-left truncate max-w-[200px]"
                style={{
                  backgroundColor: "var(--c-card2)",
                  borderColor: "var(--c-line)",
                  color: "var(--c-ink)",
                }}
                title={prompt}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        disabled={!description.trim() || status === "analyzing"}
        onClick={() => handleAnalyze()}
        className="w-full py-3 rounded-2xl text-xs font-bold bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-slate-950 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        {status === "analyzing" ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Analyzing ingredients & calculating macros...</span>
          </>
        ) : (
          <>
            <Sparkles size={16} />
            <span>Analyze Meal & Estimate Nutrition</span>
          </>
        )}
      </button>

      {/* Error state */}
      {status === "error" && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Analysis Result Display */}
      {status === "done" && result && (
        <div
          className="p-4 rounded-2xl border space-y-3 animate-in fade-in zoom-in-95 duration-200"
          style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
        >
          {/* Title & Serving */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={result.name || ""}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full text-sm font-extrabold bg-transparent outline-none border-b border-dashed border-pink-500/50 pb-0.5"
                style={{ color: "var(--c-ink)" }}
              />
              <input
                type="text"
                value={result.servingLabel || ""}
                onChange={(e) => updateField("servingLabel", e.target.value)}
                className="w-full text-xs font-medium bg-transparent outline-none mt-1"
                style={{ color: "var(--c-ink-dim)" }}
              />
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-500 border border-pink-500/30 shrink-0">
              {result.confidence || "estimated"}
            </span>
          </div>

          {/* AI Notes */}
          {result.notes && (
            <p className="text-[11px] italic" style={{ color: "var(--c-ink-dim)" }}>
              "{result.notes}"
            </p>
          )}

          {/* Core Macros Grid */}
          <div className="grid grid-cols-4 gap-2 text-center pt-1">
            <div
              className="p-2 rounded-xl border"
              style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
            >
              <div className="text-[10px] font-bold" style={{ color: "var(--c-ink-dim)" }}>
                Calories
              </div>
              <div className="text-sm font-extrabold text-pink-500 mt-0.5">
                {Math.round((result.calories || 0) * servings)}
              </div>
              <div className="text-[9px]" style={{ color: "var(--c-ink-dim)" }}>
                kcal
              </div>
            </div>
            <div
              className="p-2 rounded-xl border"
              style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
            >
              <div className="text-[10px] font-bold text-cyan-500">Protein</div>
              <div className="text-sm font-extrabold mt-0.5" style={{ color: "var(--c-ink)" }}>
                {Math.round((result.protein || 0) * servings * 10) / 10}g
              </div>
            </div>
            <div
              className="p-2 rounded-xl border"
              style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
            >
              <div className="text-[10px] font-bold text-amber-500">Carbs</div>
              <div className="text-sm font-extrabold mt-0.5" style={{ color: "var(--c-ink)" }}>
                {Math.round((result.carbs || 0) * servings * 10) / 10}g
              </div>
            </div>
            <div
              className="p-2 rounded-xl border"
              style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
            >
              <div className="text-[10px] font-bold text-rose-500">Fats</div>
              <div className="text-sm font-extrabold mt-0.5" style={{ color: "var(--c-ink)" }}>
                {Math.round((result.fat || 0) * servings * 10) / 10}g
              </div>
            </div>
          </div>

          {/* Toggle Micronutrients Accordion */}
          <div>
            <button
              type="button"
              onClick={() => setShowMicros((s) => !s)}
              className="text-xs font-bold text-pink-500 hover:underline flex items-center gap-1 mb-2"
            >
              <span>{showMicros ? "▼ Hide" : "▶ View / Edit"} Micronutrients & Vitamins</span>
            </button>

            {showMicros && (
              <div
                className="p-3 rounded-2xl border grid grid-cols-2 gap-2 mb-2 animate-in fade-in"
                style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
              >
                <NumField label="Fiber" unit="g" value={result.fiber} onChange={(v) => updateField("fiber", v)} />
                <NumField label="Sugar" unit="g" value={result.sugar} onChange={(v) => updateField("sugar", v)} />
                <NumField label="Sodium" unit="mg" value={result.sodium} onChange={(v) => updateField("sodium", v)} />
                <NumField label="Potassium" unit="mg" value={result.potassium} onChange={(v) => updateField("potassium", v)} />
                <NumField label="Calcium" unit="mg" value={result.calcium} onChange={(v) => updateField("calcium", v)} />
                <NumField label="Iron" unit="mg" value={result.iron} onChange={(v) => updateField("iron", v)} />
                <NumField label="Vitamin C" unit="mg" value={result.vitaminC} onChange={(v) => updateField("vitaminC", v)} />
              </div>
            )}
          </div>

          {/* Servings Counter */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold" style={{ color: "var(--c-ink-dim)" }}>
              Servings eaten:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setServings((s) => Math.max(0.5, Math.round((s - 0.5) * 10) / 10))}
                className="w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-sm transition"
                style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
              >
                -
              </button>
              <span className="w-10 text-center font-extrabold text-sm" style={{ color: "var(--c-ink)" }}>
                {servings}x
              </span>
              <button
                type="button"
                onClick={() => setServings((s) => Math.round((s + 0.5) * 10) / 10)}
                className="w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-sm transition"
                style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
              >
                +
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={confirmLog}
            className="w-full py-3 rounded-2xl text-xs font-bold bg-pink-500 hover:bg-pink-400 text-slate-950 shadow-md transition-all active:scale-95"
          >
            Log This Meal
          </button>
        </div>
      )}
    </div>
  );
}

function PhotoCaptureTab({ kind, apiKey, onDone, onClose }) {
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);
  const [servings, setServings] = useState(1);
  const [showMicros, setShowMicros] = useState(false);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setStatus("analyzing");
    setResult(null);
    setErrorMessage("");
    try {
      const { base64, mediaType } = await fileToOptimizedImage(file);
      const parsed = await analyzeImage(base64, mediaType, kind, apiKey);
      setResult(parsed);
      setStatus("done");
    } catch (err) {
      console.error("Image analysis error:", err);
      setStatus("error");
      setErrorMessage(err.message || "Could not analyze image.");
    }
  }

  async function runSampleDemo() {
    setStatus("analyzing");
    setResult(null);
    setErrorMessage("");
    try {
      const parsed = await analyzeImage("", "", kind, "");
      setResult(parsed);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMessage("Sample demo failed.");
    }
  }

  function updateField(field, value) {
    setResult((r) => ({ ...r, [field]: value }));
  }

  function confirmLog() {
    if (!result) return;
    const foodData = {
      name: kind === "photo" ? result.name : result.productName,
      servingLabel: result.servingLabel || "1 serving",
      calories: result.calories || 0,
      protein: result.protein || 0,
      carbs: result.carbs || 0,
      fat: result.fat || 0,
      fiber: result.fiber || 0,
      sugar: result.sugar || 0,
      sodium: result.sodium || 0,
      potassium: result.potassium || 0,
      calcium: result.calcium || 0,
      iron: result.iron || 0,
      vitaminC: result.vitaminC || 0,
    };
    onDone(foodData, servings);
    onClose();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="flex items-center gap-1.5">
          {apiKey ? (
            <span className="text-pink-500 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-pink-500" /> AI Online
            </span>
          ) : (
            <span className="text-amber-500 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Demo Sample Mode
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={runSampleDemo}
          className="text-pink-500 hover:underline flex items-center gap-1 font-bold"
        >
          <Sparkles size={13} /> Try demo meal
        </button>
      </div>

      {!preview && (
        <div className="space-y-2 mb-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-5 rounded-2xl border-2 border-dashed border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 transition-all text-pink-500 font-bold text-sm shadow-sm"
          >
            <Camera size={22} />
            <span>{kind === "photo" ? "Take Photo of Meal" : "Scan Label with Camera"}</span>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-all"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "var(--c-line)",
              color: "var(--c-ink)",
            }}
          >
            <ImageIcon size={15} /> Choose from Photo Library
          </button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      )}

      {preview && (
        <div className="mb-3 relative rounded-2xl overflow-hidden border" style={{ borderColor: "var(--c-line)" }}>
          <img src={preview} alt="Meal snapshot" className="w-full h-44 object-cover" />
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setResult(null);
              setStatus("idle");
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-900"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {status === "analyzing" && (
        <div
          className="p-6 rounded-2xl border flex flex-col items-center justify-center gap-2 text-center"
          style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
        >
          <Loader2 size={24} className="animate-spin text-pink-500" />
          <p className="text-xs font-bold" style={{ color: "var(--c-ink)" }}>
            {kind === "photo" ? "Estimating calories & nutrition..." : "Reading label & verdict..."}
          </p>
          <p className="text-[11px]" style={{ color: "var(--c-ink-dim)" }}>
            Analyzing ingredients & portion size
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex flex-col gap-2 mb-3">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle size={15} className="shrink-0" />
            <span>AI Analysis Notice</span>
          </div>
          <p className="text-[11px] leading-relaxed text-rose-400 pl-5">{errorMessage}</p>
          <div className="flex items-center gap-2 pl-5 pt-1">
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setErrorMessage("");
              }}
              className="px-3 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 text-[11px] font-bold transition"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={runSampleDemo}
              className="px-3 py-1 rounded-lg border border-pink-500/30 text-pink-400 text-[11px] font-bold transition"
            >
              Use Sample Data
            </button>
          </div>
        </div>
      )}

      {status === "done" && result && (
        <div
          className="p-4 rounded-2xl border space-y-3"
          style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={kind === "photo" ? result.name : result.productName}
                onChange={(e) => updateField(kind === "photo" ? "name" : "productName", e.target.value)}
                className="w-full text-sm font-extrabold bg-transparent outline-none border-b border-dashed border-pink-500/50 pb-0.5"
                style={{ color: "var(--c-ink)" }}
              />
              <input
                type="text"
                value={result.servingLabel || ""}
                onChange={(e) => updateField("servingLabel", e.target.value)}
                className="w-full text-xs font-medium bg-transparent outline-none mt-1"
                style={{ color: "var(--c-ink-dim)" }}
              />
            </div>
            {result.confidence && (
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-500 border border-pink-500/30 shrink-0">
                {result.confidence}
              </span>
            )}
          </div>

          {result.notes && (
            <p className="text-[11px] italic" style={{ color: "var(--c-ink-dim)" }}>
              "{result.notes}"
            </p>
          )}

          {/* Macro grid */}
          <div className="grid grid-cols-4 gap-2 text-center pt-1">
            <div
              className="p-2 rounded-xl border"
              style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
            >
              <div className="text-[10px] font-bold" style={{ color: "var(--c-ink-dim)" }}>
                Calories
              </div>
              <div className="text-sm font-extrabold text-pink-500 mt-0.5">
                {Math.round((result.calories || 0) * servings)}
              </div>
              <div className="text-[9px]" style={{ color: "var(--c-ink-dim)" }}>
                kcal
              </div>
            </div>
            <div
              className="p-2 rounded-xl border"
              style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
            >
              <div className="text-[10px] font-bold text-cyan-500">Protein</div>
              <div className="text-sm font-extrabold mt-0.5" style={{ color: "var(--c-ink)" }}>
                {Math.round((result.protein || 0) * servings * 10) / 10}g
              </div>
            </div>
            <div
              className="p-2 rounded-xl border"
              style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
            >
              <div className="text-[10px] font-bold text-amber-500">Carbs</div>
              <div className="text-sm font-extrabold mt-0.5" style={{ color: "var(--c-ink)" }}>
                {Math.round((result.carbs || 0) * servings * 10) / 10}g
              </div>
            </div>
            <div
              className="p-2 rounded-xl border"
              style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
            >
              <div className="text-[10px] font-bold text-rose-500">Fats</div>
              <div className="text-sm font-extrabold mt-0.5" style={{ color: "var(--c-ink)" }}>
                {Math.round((result.fat || 0) * servings * 10) / 10}g
              </div>
            </div>
          </div>

          {/* Toggle Micronutrients */}
          <div>
            <button
              type="button"
              onClick={() => setShowMicros((s) => !s)}
              className="text-xs font-bold text-pink-500 hover:underline flex items-center gap-1 mb-2"
            >
              <span>{showMicros ? "▼ Hide" : "▶ View / Edit"} Micronutrients & Vitamins</span>
            </button>

            {showMicros && (
              <div
                className="p-3 rounded-2xl border grid grid-cols-2 gap-2 mb-2 animate-in fade-in"
                style={{ backgroundColor: "var(--c-card-solid)", borderColor: "var(--c-line)" }}
              >
                <NumField label="Fiber" unit="g" value={result.fiber} onChange={(v) => updateField("fiber", v)} />
                <NumField label="Sugar" unit="g" value={result.sugar} onChange={(v) => updateField("sugar", v)} />
                <NumField label="Sodium" unit="mg" value={result.sodium} onChange={(v) => updateField("sodium", v)} />
                <NumField label="Potassium" unit="mg" value={result.potassium} onChange={(v) => updateField("potassium", v)} />
                <NumField label="Calcium" unit="mg" value={result.calcium} onChange={(v) => updateField("calcium", v)} />
                <NumField label="Iron" unit="mg" value={result.iron} onChange={(v) => updateField("iron", v)} />
                <NumField label="Vitamin C" unit="mg" value={result.vitaminC} onChange={(v) => updateField("vitaminC", v)} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs font-semibold" style={{ color: "var(--c-ink-dim)" }}>
              Servings eaten:
            </span>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={servings}
              onChange={(e) => setServings(parseFloat(e.target.value) || 1)}
              className="w-16 px-2.5 py-1 rounded-xl border text-sm text-center font-bold"
              style={{
                backgroundColor: "var(--c-input-bg)",
                borderColor: "var(--c-input-border)",
                color: "var(--c-input-text)",
              }}
            />
          </div>
          <button
            onClick={confirmLog}
            className="w-full py-3 rounded-2xl text-xs font-bold bg-pink-500 hover:bg-pink-400 text-slate-950 shadow-md transition-all active:scale-95"
          >
            Log This Meal
          </button>
        </div>
      )}
    </div>
  );
}

function AddFoodModal({ meal, foods, apiKey, onAddExisting, onAddNew, onClose }) {
  const [tab, setTab] = useState("text"); // Default to natural language text logger
  const [query, setQuery] = useState("");
  const [servingsMap, setServingsMap] = useState({});
  const [showCustomMicros, setShowCustomMicros] = useState(false);
  const [newFood, setNewFood] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    sugar: "",
    sodium: "",
    potassium: "",
    calcium: "",
    iron: "",
    vitaminC: "",
    servingLabel: "1 serving",
  });

  const filtered = foods.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  function getServings(id) {
    return servingsMap[id] ?? 1;
  }

  function submitNewFood() {
    const cal = parseFloat(newFood.calories) || 0;
    if (!newFood.name.trim() || cal <= 0) return;
    onAddNew(
      {
        name: newFood.name.trim(),
        calories: cal,
        protein: parseFloat(newFood.protein) || 0,
        carbs: parseFloat(newFood.carbs) || 0,
        fat: parseFloat(newFood.fat) || 0,
        fiber: parseFloat(newFood.fiber) || 0,
        sugar: parseFloat(newFood.sugar) || 0,
        sodium: parseFloat(newFood.sodium) || 0,
        potassium: parseFloat(newFood.potassium) || 0,
        calcium: parseFloat(newFood.calcium) || 0,
        iron: parseFloat(newFood.iron) || 0,
        vitaminC: parseFloat(newFood.vitaminC) || 0,
        servingLabel: newFood.servingLabel.trim() || "1 serving",
      },
      1
    );
    onClose();
  }

  return (
    <ModalShell title={`Add to ${meal}`} onClose={onClose}>
      <TabBar tab={tab} setTab={setTab} />

      {tab === "text" && (
        <TextMealTab apiKey={apiKey} onDone={onAddNew} onClose={onClose} />
      )}

      {tab === "photo" && (
        <PhotoCaptureTab kind="photo" apiKey={apiKey} onDone={onAddNew} onClose={onClose} />
      )}

      {tab === "label" && (
        <PhotoCaptureTab kind="label" apiKey={apiKey} onDone={onAddNew} onClose={onClose} />
      )}

      {tab === "search" && (
        <div>
          <input
            autoFocus
            placeholder="Search saved foods…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none mb-3"
            style={{
              backgroundColor: "var(--c-input-bg)",
              borderColor: "var(--c-input-border)",
              color: "var(--c-input-text)",
            }}
          />
          <div className="max-h-64 overflow-y-auto space-y-2">
            {filtered.length === 0 && (
              <p className="text-xs py-6 text-center" style={{ color: "var(--c-ink-dim)" }}>
                {foods.length === 0
                  ? "No saved foods yet — add one via AI Describe or Custom."
                  : "No matching foods found."}
              </p>
            )}
            {filtered.map((f) => (
              <div
                key={f.id}
                className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "var(--c-ink)" }}>
                    {f.name}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--c-ink-dim)" }}>
                    {f.calories} kcal · P {f.protein}g · C {f.carbs}g · F {f.fat}g
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={getServings(f.id)}
                    onChange={(e) =>
                      setServingsMap({
                        ...servingsMap,
                        [f.id]: parseFloat(e.target.value) || 1,
                      })
                    }
                    className="w-12 px-1.5 py-1 rounded-lg border text-xs text-center font-bold"
                    style={{
                      backgroundColor: "var(--c-input-bg)",
                      borderColor: "var(--c-input-border)",
                      color: "var(--c-input-text)",
                    }}
                  />
                  <button
                    onClick={() => {
                      onAddExisting(f, getServings(f.id));
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-pink-500 hover:bg-pink-400 text-slate-950 transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "new" && (
        <div className="space-y-3">
          <TextField
            label="Food Name"
            value={newFood.name}
            onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
            placeholder="e.g. Greek Yogurt 0% Fat"
          />
          <TextField
            label="Serving Label"
            value={newFood.servingLabel}
            onChange={(e) => setNewFood({ ...newFood, servingLabel: e.target.value })}
            placeholder="e.g. 1 cup (200g)"
          />
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="Calories (kcal) *"
              type="number"
              value={newFood.calories}
              onChange={(e) => setNewFood({ ...newFood, calories: e.target.value })}
              placeholder="120"
            />
            <TextField
              label="Protein (g)"
              type="number"
              value={newFood.protein}
              onChange={(e) => setNewFood({ ...newFood, protein: e.target.value })}
              placeholder="15"
            />
            <TextField
              label="Carbs (g)"
              type="number"
              value={newFood.carbs}
              onChange={(e) => setNewFood({ ...newFood, carbs: e.target.value })}
              placeholder="8"
            />
            <TextField
              label="Fat (g)"
              type="number"
              value={newFood.fat}
              onChange={(e) => setNewFood({ ...newFood, fat: e.target.value })}
              placeholder="0"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowCustomMicros((s) => !s)}
              className="text-xs font-bold text-pink-500 hover:underline flex items-center gap-1 mb-2"
            >
              <span>{showCustomMicros ? "▼ Hide" : "▶ Add"} Micronutrients (Vitamins & Minerals)</span>
            </button>

            {showCustomMicros && (
              <div
                className="p-3 rounded-2xl border grid grid-cols-2 gap-2 mb-2 animate-in fade-in"
                style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
              >
                <TextField label="Fiber (g)" type="number" value={newFood.fiber} onChange={(e) => setNewFood({ ...newFood, fiber: e.target.value })} />
                <TextField label="Sugar (g)" type="number" value={newFood.sugar} onChange={(e) => setNewFood({ ...newFood, sugar: e.target.value })} />
                <TextField label="Sodium (mg)" type="number" value={newFood.sodium} onChange={(e) => setNewFood({ ...newFood, sodium: e.target.value })} />
                <TextField label="Potassium (mg)" type="number" value={newFood.potassium} onChange={(e) => setNewFood({ ...newFood, potassium: e.target.value })} />
                <TextField label="Calcium (mg)" type="number" value={newFood.calcium} onChange={(e) => setNewFood({ ...newFood, calcium: e.target.value })} />
                <TextField label="Iron (mg)" type="number" value={newFood.iron} onChange={(e) => setNewFood({ ...newFood, iron: e.target.value })} />
                <TextField label="Vitamin C (mg)" type="number" value={newFood.vitaminC} onChange={(e) => setNewFood({ ...newFood, vitaminC: e.target.value })} />
              </div>
            )}
          </div>

          <button
            onClick={submitNewFood}
            className="w-full py-3 rounded-2xl text-xs font-bold bg-pink-500 hover:bg-pink-400 text-slate-950 shadow-md transition-all active:scale-95"
          >
            Save & Add to Meal
          </button>
        </div>
      )}
    </ModalShell>
  );
}

/* ---------------------------------------------------------------- */
/* UI: Settings Modal                                               */
/* ---------------------------------------------------------------- */

function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState(settings);

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
    onClose();
  }

  return (
    <ModalShell title="Profile, Targets & Nutrients" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <TextField
            label="Age"
            type="number"
            value={form.age || 25}
            onChange={(e) => setForm({ ...form, age: parseInt(e.target.value) || 25 })}
          />
          <label className="block mb-3.5">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--c-ink-dim)" }}
            >
              Biological Sex
            </span>
            <select
              value={form.sex || "male"}
              onChange={(e) => setForm({ ...form, sex: e.target.value })}
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all"
              style={{
                backgroundColor: "var(--c-input-bg)",
                borderColor: "var(--c-input-border)",
                color: "var(--c-input-text)",
              }}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>

        <TextField
          label="Daily Calorie Target (kcal)"
          type="number"
          value={form.calorieTarget}
          onChange={(e) => setForm({ ...form, calorieTarget: parseFloat(e.target.value) || 0 })}
        />

        <div className="grid grid-cols-3 gap-2">
          <TextField
            label="Protein (g)"
            type="number"
            value={form.proteinTarget}
            onChange={(e) => setForm({ ...form, proteinTarget: parseFloat(e.target.value) || 0 })}
          />
          <TextField
            label="Carbs (g)"
            type="number"
            value={form.carbTarget}
            onChange={(e) => setForm({ ...form, carbTarget: parseFloat(e.target.value) || 0 })}
          />
          <TextField
            label="Fat (g)"
            type="number"
            value={form.fatTarget}
            onChange={(e) => setForm({ ...form, fatTarget: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <label className="block mb-3.5">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--c-ink-dim)" }}
          >
            Preferred Unit
          </span>
          <select
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all"
            style={{
              backgroundColor: "var(--c-input-bg)",
              borderColor: "var(--c-input-border)",
              color: "var(--c-input-text)",
            }}
          >
            <option value="kg">Kilograms (kg)</option>
            <option value="lbs">Pounds (lbs)</option>
          </select>
        </label>

        <div>
          <TextField
            label="Gemini or Claude API Key (Optional)"
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder="AI works offline by default, or paste API key"
          />
          <p className="text-[10px] -mt-2" style={{ color: "var(--c-ink-dim)" }}>
            Leave blank to use the smart offline heuristic engine. Enter a Gemini API key for deep AI text and photo estimations.
          </p>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-2xl text-xs font-bold bg-pink-500 hover:bg-pink-400 text-slate-950 shadow-md transition-all active:scale-95"
        >
          Save Changes
        </button>
      </form>
    </ModalShell>
  );
}

function ProfileSegmentContent({
  settings,
  goalProfile,
  userProfile,
  onSaveSettings,
  onSaveUserProfile,
  onOpenGoalModal,
  onExportData,
  onImportData,
}) {
  const [form, setForm] = useState(settings);
  const [displayName, setDisplayName] = useState(userProfile?.displayName || "Athlete");
  const [avatar, setAvatar] = useState(userProfile?.avatar || "");
  const [savedNotice, setSavedNotice] = useState(false);
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    setDisplayName(userProfile?.displayName || "Athlete");
    setAvatar(userProfile?.avatar || "");
  }, [userProfile]);

  function handleSaveSettings(e) {
    e.preventDefault();
    onSaveSettings(form);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  }

  function handleSaveProfile(e) {
    e.preventDefault();
    onSaveUserProfile({ displayName, avatar });
    setProfileSavedNotice(true);
    setTimeout(() => setProfileSavedNotice(false), 2500);
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setAvatar(dataUrl);
      onSaveUserProfile({ displayName, avatar: dataUrl });
      setProfileSavedNotice(true);
      setTimeout(() => setProfileSavedNotice(false), 2500);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveAvatar() {
    setAvatar("");
    onSaveUserProfile({ displayName, avatar: "" });
    setProfileSavedNotice(true);
    setTimeout(() => setProfileSavedNotice(false), 2500);
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportStatus("Importing backup...");
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = onImportData(parsed);
      if (res && res.error) {
        setImportStatus(res.error);
      } else {
        setImportStatus("Data restored successfully!");
      }
      setTimeout(() => setImportStatus(""), 3500);
    } catch (err) {
      setImportStatus(err.message || "Failed to import JSON file");
      setTimeout(() => setImportStatus(""), 4000);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Profile Identity (Display Name & Avatar) */}
      <form onSubmit={handleSaveProfile} className="bento-card rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--c-ink)" }}>
            Profile Identity
          </span>
          {profileSavedNotice && (
            <span className="text-[11px] font-bold text-pink-400 flex items-center gap-1 animate-pulse">
              <Check size={13} /> Updated!
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div
              className="w-16 h-16 rounded-2xl border flex items-center justify-center overflow-hidden shadow-sm"
              style={{
                borderColor: "rgba(244, 63, 142, 0.38)",
                background: avatar ? "transparent" : "linear-gradient(135deg, rgba(244, 63, 142, 0.2), rgba(139, 92, 246, 0.2))",
              }}
            >
              {avatar ? (
                <img src={avatar} alt="Profile preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-pink-400">
                  {displayName ? displayName.slice(0, 2).toUpperCase() : "👤"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-pink-500 text-slate-950 shadow hover:scale-105 active:scale-95 transition"
              title="Upload profile picture"
            >
              <Camera size={12} />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--c-ink-dim)" }}>
                Display Name
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Vaibhav"
                className="w-full mt-1 px-3 py-1.5 rounded-xl border text-sm outline-none transition"
                style={{
                  backgroundColor: "var(--c-input-bg)",
                  borderColor: "var(--c-input-border)",
                  color: "var(--c-input-text)",
                }}
              />
            </label>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="text-[11px] font-bold text-pink-400 hover:underline flex items-center gap-1"
              >
                <Upload size={11} /> Change Photo
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-[11px] font-bold text-rose-400 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2 rounded-xl text-xs font-black bg-pink-500 hover:bg-pink-400 text-slate-950 shadow-md transition-all active:scale-95"
        >
          Save Identity
        </button>
      </form>

      {/* 2. Goal Strategy Bento Card */}
      <div
        className="bento-card rounded-2xl p-4 space-y-3"
        style={{ borderColor: "rgba(244, 63, 142, 0.35)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
              <Target size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--c-ink)" }}>
                Goal Strategy
              </h3>
              <p className="text-[10px]" style={{ color: "var(--c-ink-dim)" }}>
                {goalProfile
                  ? `${(goalProfile.direction || goalProfile.goalType || "CUT").toUpperCase()} · Target ${goalProfile.targetWeight || "—"} ${settings.unit}${goalProfile.currentWeight ? ` (from ${goalProfile.currentWeight} ${settings.unit})` : ""}`
                  : "Custom Target Split"}
              </p>
            </div>
          </div>
          <button
            onClick={onOpenGoalModal}
            className="px-3 py-1.5 rounded-xl text-xs font-black border transition active:scale-95 shrink-0"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "var(--c-line)",
              color: "var(--c-macro-cal)",
            }}
          >
            {goalProfile ? "Recalculate" : "Set Goal"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="p-2.5 rounded-xl border text-center" style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-macro-pro-border)" }}>
            <span className="text-[10px] font-bold uppercase" style={{ color: "var(--c-macro-pro)" }}>Protein</span>
            <div className="text-sm font-black mt-0.5" style={{ color: "var(--c-ink)" }}>{settings.proteinTarget}g</div>
          </div>
          <div className="p-2.5 rounded-xl border text-center" style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-macro-carb-border)" }}>
            <span className="text-[10px] font-bold uppercase" style={{ color: "var(--c-macro-carb)" }}>Carbs</span>
            <div className="text-sm font-black mt-0.5" style={{ color: "var(--c-ink)" }}>{settings.carbTarget}g</div>
          </div>
          <div className="p-2.5 rounded-xl border text-center" style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-macro-fat-border)" }}>
            <span className="text-[10px] font-bold uppercase" style={{ color: "var(--c-macro-fat)" }}>Fats</span>
            <div className="text-sm font-black mt-0.5" style={{ color: "var(--c-ink)" }}>{settings.fatTarget}g</div>
          </div>
        </div>
      </div>

      {/* 3. Biometrics & Lifestyle Settings (TARGETS AREA REMOVED) */}
      <form onSubmit={handleSaveSettings} className="bento-card rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--c-ink)" }}>
            Biometrics & Preferences
          </span>
          {savedNotice && (
            <span className="text-[11px] font-bold text-pink-400 flex items-center gap-1 animate-pulse">
              <Check size={13} /> Saved!
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <TextField
            label="Age"
            type="number"
            value={form.age || 25}
            onChange={(e) => setForm({ ...form, age: parseInt(e.target.value) || 25 })}
          />
          <label className="block mb-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--c-ink-dim)" }}>
              Biological Sex
            </span>
            <select
              value={form.sex || "male"}
              onChange={(e) => setForm({ ...form, sex: e.target.value })}
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all"
              style={{
                backgroundColor: "var(--c-input-bg)",
                borderColor: "var(--c-input-border)",
                color: "var(--c-input-text)",
              }}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <TextField
            label="Height (cm)"
            type="number"
            value={form.heightCm || 175}
            onChange={(e) => setForm({ ...form, heightCm: parseFloat(e.target.value) || 175 })}
          />
          <label className="block mb-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--c-ink-dim)" }}>
              Weight Unit
            </span>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all"
              style={{
                backgroundColor: "var(--c-input-bg)",
                borderColor: "var(--c-input-border)",
                color: "var(--c-input-text)",
              }}
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lbs">Pounds (lbs)</option>
            </select>
          </label>
        </div>

        <label className="block mb-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--c-ink-dim)" }}>
            Weekly Activity Level
          </span>
          <select
            value={form.activity || "light"}
            onChange={(e) => setForm({ ...form, activity: e.target.value })}
            className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all"
            style={{
              backgroundColor: "var(--c-input-bg)",
              borderColor: "var(--c-input-border)",
              color: "var(--c-input-text)",
            }}
          >
            <option value="sedentary">Sedentary (desk job, 0-1 workouts/wk) · 1.20×</option>
            <option value="light">Lightly Active (1-3 workouts/wk) · 1.375×</option>
            <option value="moderate">Moderately Active (3-5 workouts/wk) · 1.55×</option>
            <option value="active">Very Active (6-7 workouts/wk) · 1.725×</option>
            <option value="veryActive">Extremely Active (physical job & hard training) · 1.90×</option>
          </select>
        </label>

        <div>
          <TextField
            label="AI Key (Gemini / Claude - Optional)"
            type="password"
            value={form.apiKey || ""}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder="Works offline by default, or paste API key"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl text-xs font-black bg-pink-500 hover:bg-pink-400 text-slate-950 shadow-md transition-all active:scale-95"
        >
          Save Preferences
        </button>
      </form>

      {/* 4. Data Management (Backup & Restore) */}
      <div className="bento-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <Database size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--c-ink)" }}>
              Data Management
            </h3>
            <p className="text-[10px]" style={{ color: "var(--c-ink-dim)" }}>
              Backup your meals, weights, water, and goals or restore from file
            </p>
          </div>
        </div>

        {importStatus && (
          <div className="text-xs font-bold p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400 text-center animate-pulse">
            {importStatus}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onExportData}
            className="py-2.5 px-3 rounded-xl text-xs font-bold border transition active:scale-95 flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "var(--c-line)",
              color: "var(--c-ink)",
            }}
          >
            <Download size={14} className="text-pink-400" /> Export JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-2.5 px-3 rounded-xl text-xs font-bold border transition active:scale-95 flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "var(--c-line)",
              color: "var(--c-ink)",
            }}
          >
            <FileUp size={14} className="text-pink-400" /> Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
      </div>

      {/* 5. iPhone & Safari Setup Guide */}
      <div className="bento-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <Share2 size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--c-ink)" }}>
              Use on iPhone & iPad
            </h3>
            <p className="text-[10px]" style={{ color: "var(--c-ink-dim)" }}>
              Run Bento in full-screen standalone mode without browser address bars
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="p-2.5 rounded-xl border flex flex-col items-center justify-center" style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}>
            <span className="text-xs font-black text-pink-400 mb-0.5">1. Open Safari</span>
            <span className="text-[9px] leading-tight" style={{ color: "var(--c-ink-dim)" }}>Open app URL in Safari</span>
          </div>
          <div className="p-2.5 rounded-xl border flex flex-col items-center justify-center" style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}>
            <span className="text-xs font-black text-pink-400 mb-0.5">2. Tap Share ⎋</span>
            <span className="text-[9px] leading-tight" style={{ color: "var(--c-ink-dim)" }}>Bottom toolbar in Safari</span>
          </div>
          <div className="p-2.5 rounded-xl border flex flex-col items-center justify-center" style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}>
            <span className="text-xs font-black text-pink-400 mb-0.5">3. Add to Home ➕</span>
            <span className="text-[9px] leading-tight" style={{ color: "var(--c-ink-dim)" }}>Install as full-screen app</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* UI: Goal Modal                                                   */
/* ---------------------------------------------------------------- */

function GoalModal({
  settings,
  lastWeightKg,
  expenditure,
  savedProfile,
  onApply,
  onSaveProfile,
  onSaveWeight,
  onClose,
}) {
  const initialCurrentWeight = useMemo(() => {
    if (savedProfile?.currentWeight != null) return savedProfile.currentWeight;
    if (lastWeightKg) {
      return settings.unit === "lbs"
        ? Math.round(kgToLbs(lastWeightKg) * 10) / 10
        : Math.round(lastWeightKg * 10) / 10;
    }
    return settings.unit === "lbs" ? 158 : 72;
  }, [savedProfile, lastWeightKg, settings.unit]);

  const [direction, setDirection] = useState(savedProfile?.direction || savedProfile?.goalType || "lose");
  const [activity, setActivity] = useState(savedProfile?.activity || settings.activity || "light");
  const [currentWeight, setCurrentWeight] = useState(initialCurrentWeight);
  const [targetWeight, setTargetWeight] = useState(
    savedProfile?.targetWeight ??
      (direction === "lose"
        ? Math.round(initialCurrentWeight * 0.95 * 10) / 10
        : direction === "gain"
        ? Math.round(initialCurrentWeight * 1.05 * 10) / 10
        : initialCurrentWeight)
  );
  const [weeks, setWeeks] = useState(savedProfile?.weeks ?? 12);
  const [proteinStyle, setProteinStyle] = useState(savedProfile?.proteinStyle || "high");

  function handleDirectionChange(newDir) {
    setDirection(newDir);
    const cur = parseFloat(currentWeight) || initialCurrentWeight;
    if (newDir === "maintain") {
      setTargetWeight(cur);
    } else if (newDir === "lose") {
      const curTar = parseFloat(targetWeight);
      if (!curTar || curTar >= cur) {
        setTargetWeight(Math.round(cur * 0.95 * 10) / 10);
      }
    } else if (newDir === "gain") {
      const curTar = parseFloat(targetWeight);
      if (!curTar || curTar <= cur) {
        setTargetWeight(Math.round(cur * 1.05 * 10) / 10);
      }
    }
  }

  const plan = useMemo(() => {
    const curNum = parseFloat(currentWeight) || (settings.unit === "lbs" ? 158 : 72);
    const tarNum = parseFloat(targetWeight) || curNum;
    const curKg = settings.unit === "lbs" ? lbsToKg(curNum) : curNum;
    const goalKg = settings.unit === "lbs" ? lbsToKg(tarNum) : tarNum;
    const weeksNum = Math.max(1, parseFloat(weeks) || 12);

    const calculated = computeGoalPlan({
      sex: settings.sex || "male",
      age: settings.age || 25,
      heightCm: settings.heightCm || 175,
      currentWeightKg: curKg,
      goalWeightKg: goalKg,
      activity: activity,
      timeframeWeeksInput: weeksNum,
      measuredExpenditure: expenditure ? expenditure.expenditure : null,
      useMeasured: !!expenditure,
    });

    if (!calculated) {
      const fallbackTDEE = expenditure?.expenditure || 2400;
      return {
        bmr: 1700,
        tdee: fallbackTDEE,
        weeklyRateKg: 0,
        weeksUsed: weeksNum,
        calorieTarget: settings.calorieTarget || fallbackTDEE,
        proteinTarget: settings.proteinTarget || 150,
        carbTarget: settings.carbTarget || 250,
        fatTarget: settings.fatTarget || 60,
        direction,
        warning: null,
      };
    }

    let adjustedProtein = calculated.proteinTarget;
    if (proteinStyle === "moderate") {
      adjustedProtein = Math.round(curKg * 1.6);
    } else if (proteinStyle === "very_high") {
      adjustedProtein = Math.round(curKg * 2.4);
    } else if (proteinStyle === "high") {
      adjustedProtein = Math.round(curKg * 2.0);
    }
    const proteinDeltaKcal = (adjustedProtein - calculated.proteinTarget) * 4;
    const adjustedCarbs = Math.max(20, Math.round(calculated.carbTarget - proteinDeltaKcal / 4));

    return {
      ...calculated,
      proteinTarget: adjustedProtein,
      carbTarget: adjustedCarbs,
    };
  }, [currentWeight, targetWeight, weeks, expenditure, settings, direction, proteinStyle, activity]);

  const displayWeeklyRate = useMemo(() => {
    if (!plan) return `0.00 ${settings.unit}/wk`;
    const absKg = Math.abs(plan.weeklyRateKg || 0);
    const val = settings.unit === "lbs" ? kgToLbs(absKg) : absKg;
    const sign = plan.weeklyRateKg < -0.01 ? "-" : plan.weeklyRateKg > 0.01 ? "+" : "";
    return `${sign}${val.toFixed(2)} ${settings.unit}/wk`;
  }, [plan, settings.unit]);

  function handleApply() {
    if (plan) {
      onApply({
        ...settings,
        activity,
        calorieTarget: plan.calorieTarget,
        proteinTarget: plan.proteinTarget,
        carbTarget: plan.carbTarget,
        fatTarget: plan.fatTarget,
      });
    }
    const curNum = parseFloat(currentWeight) || (settings.unit === "lbs" ? 158 : 72);
    const tarNum = parseFloat(targetWeight) || curNum;
    const curKg = settings.unit === "lbs" ? lbsToKg(curNum) : curNum;

    onSaveProfile({
      direction,
      goalType: direction,
      currentWeight: curNum,
      targetWeight: tarNum,
      weeks: parseFloat(weeks) || 12,
      proteinStyle,
      activity,
    });

    if (onSaveWeight) {
      onSaveWeight(Math.round(curKg * 10) / 10);
    }
    onClose();
  }

  return (
    <ModalShell title="Body Goal Strategy" onClose={onClose}>
      <div className="space-y-4">
        {/* Row 1: Goal Type & Current Weight */}
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--c-ink-dim)" }}
            >
              Goal Strategy
            </span>
            <select
              value={direction}
              onChange={(e) => handleDirectionChange(e.target.value)}
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all font-medium"
              style={{
                backgroundColor: "var(--c-input-bg)",
                borderColor: "var(--c-input-border)",
                color: "var(--c-input-text)",
              }}
            >
              <option value="lose">Fat Loss (Cut)</option>
              <option value="gain">Muscle Gain (Bulk)</option>
              <option value="maintain">Maintenance</option>
            </select>
          </label>

          <TextField
            label={`Current Weight (${settings.unit})`}
            type="number"
            step="0.1"
            value={currentWeight}
            onChange={(e) => setCurrentWeight(e.target.value)}
          />
        </div>

        {/* Row 2: Target Weight & Duration */}
        <div className="grid grid-cols-2 gap-2.5">
          <TextField
            label={`Target Weight (${settings.unit})`}
            type="number"
            step="0.1"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
          />

          <TextField
            label="Duration (Weeks)"
            type="number"
            min="1"
            max="104"
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
          />
        </div>

        {/* Row 3: Weekly Activity Level (amount of activity per week) */}
        <label className="block">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--c-ink-dim)" }}
          >
            Weekly Activity Level
          </span>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all font-medium"
            style={{
              backgroundColor: "var(--c-input-bg)",
              borderColor: "var(--c-input-border)",
              color: "var(--c-input-text)",
            }}
          >
            <option value="sedentary">Sedentary (desk job, 0-1 workouts/wk) · 1.20×</option>
            <option value="light">Lightly Active (1-3 workouts/wk) · 1.375×</option>
            <option value="moderate">Moderately Active (3-5 workouts/wk) · 1.55×</option>
            <option value="active">Very Active (6-7 workouts/wk) · 1.725×</option>
            <option value="veryActive">Extremely Active (physical job & heavy training) · 1.90×</option>
          </select>
        </label>

        {/* Row 4: Protein Preference & Adaptive TDEE badge */}
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--c-ink-dim)" }}
            >
              Protein Target
            </span>
            <select
              value={proteinStyle}
              onChange={(e) => setProteinStyle(e.target.value)}
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all font-medium"
              style={{
                backgroundColor: "var(--c-input-bg)",
                borderColor: "var(--c-input-border)",
                color: "var(--c-input-text)",
              }}
            >
              <option value="moderate">Moderate (1.6g/kg)</option>
              <option value="high">High (2.0g/kg)</option>
              <option value="very_high">Very High (2.4g/kg)</option>
            </select>
          </label>

          <div className="flex flex-col justify-end">
            <span
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--c-ink-dim)" }}
            >
              Energy Engine
            </span>
            <div
              className="px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between"
              style={{
                backgroundColor: "var(--c-input-bg)",
                borderColor: "var(--c-input-border)",
                color: "var(--c-ink)",
              }}
            >
              <span className="truncate">{expenditure ? "Adaptive TDEE" : "Formula BMR"}</span>
              <span className="font-extrabold text-pink-400 shrink-0 ml-1">
                {plan.tdee.toLocaleString()} kcal
              </span>
            </div>
          </div>
        </div>

        {/* Calculated Recommended Targets Bento Box */}
        <div
          className="p-4 rounded-2xl border space-y-3"
          style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
        >
          <div className="flex justify-between items-center">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--c-ink-dim)" }}
            >
              Optimal Daily Target
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-pink-500/15 text-pink-400 border border-pink-500/30">
              {displayWeeklyRate}
            </span>
          </div>

          <div className="text-center my-1.5">
            <span className="text-3xl font-extrabold text-pink-400 tracking-tight">
              {plan.calorieTarget.toLocaleString()}
            </span>
            <span className="text-xs ml-1.5 font-medium" style={{ color: "var(--c-ink-dim)" }}>
              kcal / day
            </span>
          </div>

          {plan.warning && (
            <div className="text-[11px] font-medium p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 leading-relaxed flex items-start gap-1.5">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" />
              <span>{plan.warning}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div
              className="p-2.5 rounded-xl border"
              style={{
                backgroundColor: "var(--c-card-solid)",
                borderColor: "var(--c-macro-pro-border)",
              }}
            >
              <div className="text-[10px] font-bold uppercase" style={{ color: "var(--c-macro-pro)" }}>
                Protein
              </div>
              <div className="text-sm font-black mt-0.5" style={{ color: "var(--c-ink)" }}>
                {plan.proteinTarget}g
              </div>
            </div>
            <div
              className="p-2.5 rounded-xl border"
              style={{
                backgroundColor: "var(--c-card-solid)",
                borderColor: "var(--c-macro-carb-border)",
              }}
            >
              <div className="text-[10px] font-bold uppercase" style={{ color: "var(--c-macro-carb)" }}>
                Carbs
              </div>
              <div className="text-sm font-black mt-0.5" style={{ color: "var(--c-ink)" }}>
                {plan.carbTarget}g
              </div>
            </div>
            <div
              className="p-2.5 rounded-xl border"
              style={{
                backgroundColor: "var(--c-card-solid)",
                borderColor: "var(--c-macro-fat-border)",
              }}
            >
              <div className="text-[10px] font-bold uppercase" style={{ color: "var(--c-macro-fat)" }}>
                Fat
              </div>
              <div className="text-sm font-black mt-0.5" style={{ color: "var(--c-ink)" }}>
                {plan.fatTarget}g
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleApply}
          className="w-full py-3.5 rounded-2xl text-xs font-black bg-pink-500 hover:bg-pink-400 text-slate-950 shadow-lg shadow-pink-500/25 glow-pink transition-all active:scale-95 uppercase tracking-wider"
        >
          Apply Plan Targets & Set Current Weight
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------- */
/* UI: Calendar Date Selector Modal                                 */
/* ---------------------------------------------------------------- */

function CalendarModal({ selectedDate, onSelectDate, loggedDates = new Set(), onClose }) {
  const parts = selectedDate.split("-");
  const initYear = parseInt(parts[0], 10) || new Date().getFullYear();
  const initMonth = (parseInt(parts[1], 10) || (new Date().getMonth() + 1)) - 1;

  const [currentYear, setCurrentYear] = useState(initYear);
  const [currentMonth, setCurrentMonth] = useState(initMonth);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(currentMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dStr = `${currentYear}-${mm}-${dd}`;
    cells.push({ day, dateStr: dStr });
  }

  const today = todayStr();

  return (
    <ModalShell title="Select Date" onClose={onClose}>
      <div className="space-y-4">
        {/* Month Header Navigation */}
        <div
          className="flex items-center justify-between p-2 rounded-2xl border"
          style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
        >
          <button
            type="button"
            onClick={prevMonth}
            className="p-2 rounded-xl border transition active:scale-95"
            style={{
              backgroundColor: "var(--c-card-solid)",
              borderColor: "var(--c-line)",
              color: "var(--c-ink)",
            }}
            title="Previous Month"
          >
            <ChevronLeft size={16} />
          </button>

          <div
            className="text-sm font-extrabold flex items-center gap-1.5"
            style={{ color: "var(--c-ink)" }}
          >
            <Calendar size={16} className="text-pink-500" />
            <span>{monthNames[currentMonth]} {currentYear}</span>
          </div>

          <button
            type="button"
            onClick={nextMonth}
            className="p-2 rounded-xl border transition active:scale-95"
            style={{
              backgroundColor: "var(--c-card-solid)",
              borderColor: "var(--c-line)",
              color: "var(--c-ink)",
            }}
            title="Next Month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Days of Week Header */}
        <div
          className="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wider py-1"
          style={{ color: "var(--c-ink-dim)" }}
        >
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
            <div key={d} className={i === 0 || i === 6 ? "text-rose-400" : ""}>{d}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {cells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="h-10" />;
            }

            const isSelected = cell.dateStr === selectedDate;
            const isToday = cell.dateStr === today;
            const hasLogs = loggedDates.has(cell.dateStr);

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => {
                  onSelectDate(cell.dateStr);
                  onClose();
                }}
                className={`h-10 rounded-xl flex flex-col items-center justify-center text-xs font-bold relative transition-all active:scale-90 ${
                  isSelected
                    ? "shadow-md scale-105"
                    : isToday
                    ? "border-2 border-pink-500"
                    : "border"
                }`}
                style={{
                  backgroundColor: isSelected
                    ? "#F43F8E"
                    : "var(--c-card-solid)",
                  borderColor: isSelected
                    ? "#F43F8E"
                    : isToday
                    ? "#F43F8E"
                    : "var(--c-line)",
                  color: isSelected ? "#0B0F17" : "var(--c-ink)",
                }}
              >
                <span>{cell.day}</span>
                {/* Dot indicator for logged entries */}
                {hasLogs && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500 absolute bottom-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Shortcuts */}
        <div className="pt-3 border-t grid grid-cols-3 gap-2" style={{ borderColor: "var(--c-line)" }}>
          <button
            type="button"
            onClick={() => {
              onSelectDate(today);
              onClose();
            }}
            className="py-2 rounded-xl text-xs font-bold border transition active:scale-95"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "var(--c-line)",
              color: "var(--c-ink)",
            }}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectDate(addDays(today, -1));
              onClose();
            }}
            className="py-2 rounded-xl text-xs font-bold border transition active:scale-95"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "var(--c-line)",
              color: "var(--c-ink)",
            }}
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectDate(addDays(today, -7));
              onClose();
            }}
            className="py-2 rounded-xl text-xs font-bold border transition active:scale-95"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "var(--c-line)",
              color: "var(--c-ink)",
            }}
          >
            7 Days Ago
          </button>
        </div>

        {/* Direct HTML Native Date Picker Input */}
        <div
          className="flex items-center justify-between p-3 rounded-2xl border text-xs"
          style={{ backgroundColor: "var(--c-card2)", borderColor: "var(--c-line)" }}
        >
          <span className="font-semibold" style={{ color: "var(--c-ink-dim)" }}>
            Jump to specific date:
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                onSelectDate(e.target.value);
                onClose();
              }
            }}
            className="px-2.5 py-1 rounded-xl border text-xs font-semibold outline-none"
            style={{
              backgroundColor: "var(--c-input-bg)",
              borderColor: "var(--c-input-border)",
              color: "var(--c-input-text)",
            }}
          />
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------- */
/* Main Application Component                                       */
/* ---------------------------------------------------------------- */

export default function DietTracker() {
  const [dateStr, setDateStr] = useState(todayStr());
  const [entries, setEntries] = useState([]);
  const [weights, setWeights] = useState({});
  const [foods, setFoods] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [waterLogs, setWaterLogs] = useState({});
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // Theme: Dark by default
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem("diet_theme") !== "light";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove("light");
      root.classList.add("dark");
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0B0F17");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#F8FAFC");
    }
    try {
      localStorage.setItem("diet_theme", isDark ? "dark" : "light");
    } catch {}
  }, [isDark]);

  const [activeTab, setActiveTab] = useState("today"); // 'today' | 'trends' | 'nutrition' | 'profile'
  const [addFoodMeal, setAddFoodMeal] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showNutrientsModal, setShowNutrientsModal] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [goalProfile, setGoalProfile] = useState(null);
  const [userProfile, setUserProfile] = useState(DEFAULT_USER_PROFILE);
  const [saveError, setSaveError] = useState("");
  const [showIOSBanner, setShowIOSBanner] = useState(() => {
    try {
      if (typeof window === "undefined" || typeof navigator === "undefined") return false;
      const dismissed = localStorage.getItem("bento_ios_banner_dismissed");
      if (dismissed === "true") return false;
      const isIOS =
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
        !window.MSStream;
      const isStandalone =
        window.navigator.standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      return isIOS && !isStandalone;
    } catch {
      return false;
    }
  });

  function dismissIOSBanner() {
    setShowIOSBanner(false);
    try {
      localStorage.setItem("bento_ios_banner_dismissed", "true");
    } catch {}
  }

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const safeGet = (k) => {
        const v = localStorage.getItem(`diet_${k}`);
        return v ? JSON.parse(v) : null;
      };

      const savedEntries = safeGet("entries");
      if (savedEntries) setEntries(savedEntries);

      const savedWeights = safeGet("weights");
      if (savedWeights) setWeights(savedWeights);

      const savedFoods = safeGet("foods");
      if (savedFoods) setFoods(savedFoods);

      const savedSettings = safeGet("settings");
      if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });

      const savedWater = safeGet("water");
      if (savedWater) setWaterLogs(savedWater);

      const savedGoal = safeGet("goal_profile");
      if (savedGoal) setGoalProfile(savedGoal);

      const savedUser = safeGet("user_profile");
      if (savedUser) setUserProfile({ ...DEFAULT_USER_PROFILE, ...savedUser });
    } catch (err) {
      console.error("Failed to load diet data from localStorage", err);
    }
  }, []);

  // Save changes
  function persist(k, val) {
    try {
      localStorage.setItem(`diet_${k}`, JSON.stringify(val));
      setSaveError("");
    } catch (e) {
      setSaveError("Failed to save to local storage.");
    }
  }

  function saveSettings(s) {
    setSettings(s);
    persist("settings", s);
  }

  function saveGoalProfile(g) {
    setGoalProfile(g);
    persist("goal_profile", g);
  }

  function saveUserProfile(u) {
    setUserProfile(u);
    persist("user_profile", u);
  }

  function handleExportData() {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userProfile,
      settings,
      goalProfile,
      entries,
      weights,
      waterLogs,
      foods,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bento-backup-${dateStr || todayStr()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleImportData(backupData) {
    try {
      if (!backupData || typeof backupData !== "object") {
        return { success: false, error: "Invalid JSON backup file." };
      }
      if (backupData.userProfile) {
        setUserProfile(backupData.userProfile);
        persist("user_profile", backupData.userProfile);
      }
      if (backupData.settings) {
        const nextSettings = { ...DEFAULT_SETTINGS, ...backupData.settings };
        setSettings(nextSettings);
        persist("settings", nextSettings);
      }
      if (backupData.goalProfile) {
        setGoalProfile(backupData.goalProfile);
        persist("goal_profile", backupData.goalProfile);
      }
      if (Array.isArray(backupData.entries)) {
        setEntries(backupData.entries);
        persist("entries", backupData.entries);
      }
      if (backupData.weights && typeof backupData.weights === "object") {
        setWeights(backupData.weights);
        persist("weights", backupData.weights);
      }
      if (backupData.waterLogs && typeof backupData.waterLogs === "object") {
        setWaterLogs(backupData.waterLogs);
        persist("water", backupData.waterLogs);
      }
      if (Array.isArray(backupData.foods)) {
        setFoods(backupData.foods);
        persist("foods", backupData.foods);
      }
      return { success: true };
    } catch (err) {
      console.error("Failed to restore backup", err);
      return { success: false, error: err.message || "Failed to parse data." };
    }
  }

  function saveWeightEntry(d, kg) {
    const next = { ...weights, [d]: kg };
    setWeights(next);
    persist("weights", next);
  }

  function deleteWeightEntry(d) {
    const next = { ...weights };
    delete next[d];
    setWeights(next);
    persist("weights", next);
  }

  function saveWater(amountMl) {
    const cur = waterLogs[dateStr] || 0;
    const nextVal = Math.max(0, cur + amountMl);
    const next = { ...waterLogs, [dateStr]: nextVal };
    setWaterLogs(next);
    persist("water", next);
  }

  function addExistingFoodEntry(meal, food, servings) {
    const mult = servings || 1;
    const entry = {
      id: Date.now().toString(),
      date: dateStr,
      meal,
      foodId: food.id,
      name: food.name,
      servingLabel: food.servingLabel,
      servings: mult,
      calories: Math.round(food.calories * mult),
      protein: Math.round(food.protein * mult * 10) / 10,
      carbs: Math.round(food.carbs * mult * 10) / 10,
      fat: Math.round(food.fat * mult * 10) / 10,
      fiber: Math.round((food.fiber || 0) * mult * 10) / 10,
      sugar: Math.round((food.sugar || 0) * mult * 10) / 10,
      sodium: Math.round((food.sodium || 0) * mult),
      potassium: Math.round((food.potassium || 0) * mult),
      calcium: Math.round((food.calcium || 0) * mult),
      iron: Math.round((food.iron || 0) * mult * 10) / 10,
      vitaminC: Math.round((food.vitaminC || 0) * mult),
    };
    const next = [...entries, entry];
    setEntries(next);
    persist("entries", next);
  }

  function addNewFoodAndLog(meal, foodData, servings) {
    const foodId = Date.now().toString();
    const newFoodItem = {
      id: foodId,
      ...foodData,
    };
    const nextFoods = [...foods, newFoodItem];
    setFoods(nextFoods);
    persist("foods", nextFoods);

    addExistingFoodEntry(meal, newFoodItem, servings);
  }

  function deleteEntry(id) {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    persist("entries", next);
  }

  // Day entries & Totals
  const dayEntries = useMemo(
    () => entries.filter((e) => e.date === dateStr),
    [entries, dateStr]
  );

  const totals = useMemo(() => {
    return dayEntries.reduce(
      (acc, e) => ({
        calories: acc.calories + (e.calories || 0),
        protein: acc.protein + (e.protein || 0),
        carbs: acc.carbs + (e.carbs || 0),
        fat: acc.fat + (e.fat || 0),
        fiber: acc.fiber + (e.fiber || 0),
        sugar: acc.sugar + (e.sugar || 0),
        sodium: acc.sodium + (e.sodium || 0),
        potassium: acc.potassium + (e.potassium || 0),
        calcium: acc.calcium + (e.calcium || 0),
        iron: acc.iron + (e.iron || 0),
        vitaminC: acc.vitaminC + (e.vitaminC || 0),
      }),
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        potassium: 0,
        calcium: 0,
        iron: 0,
        vitaminC: 0,
      }
    );
  }, [dayEntries]);

  // Expenditure & Weight trends
  const weightSeries = useMemo(() => {
    return computeWeightSeries(weights, 30);
  }, [weights]);

  const expenditure = useMemo(() => {
    return computeExpenditure(weights, entries);
  }, [weights, entries]);

  const lastWeight = useMemo(() => {
    const keys = Object.keys(weights).sort();
    if (keys.length === 0) return null;
    const latestDate = keys[keys.length - 1];
    const kg = weights[latestDate];
    return {
      date: latestDate,
      weight: kg,
      trend: settings.unit === "lbs" ? kgToLbs(kg) : kg,
    };
  }, [weights, settings.unit]);

  // Scientific daily recommended intakes based on profile
  const nutrientTargets = useMemo(() => {
    return computeDailyNutrientTargets({
      age: settings.age || 25,
      sex: settings.sex || "male",
      weightKg: lastWeight ? lastWeight.weight : 72,
      calorieTarget: settings.calorieTarget || 2600,
    });
  }, [settings, lastWeight]);

  const loggedDates = useMemo(() => {
    const set = new Set();
    for (const e of entries) {
      if (e.date) set.add(e.date);
    }
    for (const d of Object.keys(weights)) {
      set.add(d);
    }
    return set;
  }, [entries, weights]);

  // Dynamic consecutive days streak
  const streakInfo = useMemo(() => {
    return computeUserStreak(entries, weights, waterLogs);
  }, [entries, weights, waterLogs]);

  const currentWater = waterLogs[dateStr] || 0;
  const activeBurn = 520; // Default active burn

  return (
    <div
      className="min-h-screen font-sans transition-colors duration-300 w-full"
      style={{
        backgroundColor: "var(--c-canvas)",
        color: "var(--c-ink)",
        paddingTop: "max(var(--sat, 0px) + 0.75rem, 1.25rem)",
        paddingBottom: "max(var(--sab, 0px) + 6.5rem, 7rem)",
      }}
    >
      {/* Main Container tailored for Nothing CMF Phone 1 (412px width, 20:9 ratio) */}
      <div className="w-full max-w-[428px] mx-auto px-4 space-y-5">
        {/* ── Top Header ── */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* User Profile Picture Avatar Button (positioned to the left of Bento logo/name) */}
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className="relative w-10 h-10 rounded-2xl p-0.5 border shadow-sm shrink-0 cursor-pointer active:scale-95 transition overflow-hidden group"
              style={{
                borderColor: activeTab === "profile" ? "var(--c-macro-cal)" : "var(--c-line)",
                backgroundColor: "var(--c-card2)",
              }}
              title="Open Profile"
            >
              {userProfile?.avatar ? (
                <img
                  src={userProfile.avatar}
                  alt={userProfile.displayName || "User"}
                  className="w-full h-full object-cover rounded-[14px]"
                />
              ) : (
                <div className="w-full h-full rounded-[14px] flex items-center justify-center font-black text-sm bg-gradient-to-br from-pink-500/25 via-rose-500/20 to-purple-500/20 text-pink-400 border border-pink-500/30">
                  {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : <User size={18} />}
                </div>
              )}
              {/* Subtle active tab dot indicator on avatar */}
              {activeTab === "profile" && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-pink-500 rounded-full border-2 border-slate-950" />
              )}
            </button>

            {/* Logo & Context */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("today")}
                  className="text-base font-black tracking-tight text-left flex items-center gap-1.5 active:scale-95 transition"
                  title="Return to Today"
                >
                  <span className="bg-gradient-to-r from-pink-500 via-rose-400 to-pink-400 bg-clip-text text-transparent font-black tracking-wider text-base">
                    BENTO
                  </span>
                </button>
                {activeTab !== "today" && (
                  <button
                    onClick={() => setActiveTab("today")}
                    className="text-[11px] font-bold text-pink-400 hover:underline flex items-center gap-0.5"
                  >
                    ← Today
                  </button>
                )}
              </div>

              {activeTab === "today" ? (
                /* Date Bar with Direct Calendar Selector */
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setDateStr(addDays(dateStr, -1))}
                    className="p-1.5 rounded-lg border transition hover:opacity-80 active:scale-95"
                    style={{
                      backgroundColor: "var(--c-card2)",
                      borderColor: "var(--c-line)",
                      color: "var(--c-ink)",
                    }}
                    title="Previous Day"
                  >
                    <ChevronLeft size={13} />
                  </button>

                  {/* Clickable Calendar Picker Button */}
                  <button
                    type="button"
                    onClick={() => setShowCalendarModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border hover:border-pink-500/50 transition active:scale-95 shadow-sm"
                    style={{
                      backgroundColor: "var(--c-card2)",
                      borderColor: "var(--c-line)",
                    }}
                    title="Select any date from calendar"
                  >
                    <Calendar size={13} className="text-pink-500" />
                    <span className="text-xs font-bold" style={{ color: "var(--c-ink)" }}>
                      {formatDateLabel(dateStr)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDateStr(addDays(dateStr, 1))}
                    className="p-1.5 rounded-lg border transition hover:opacity-80 active:scale-95"
                    style={{
                      backgroundColor: "var(--c-card2)",
                      borderColor: "var(--c-line)",
                      color: "var(--c-ink)",
                    }}
                    title="Next Day"
                  >
                    <ChevronRight size={13} />
                  </button>

                  {dateStr !== todayStr() && (
                    <button
                      type="button"
                      onClick={() => setDateStr(todayStr())}
                      className="text-[10px] font-bold text-pink-500 uppercase tracking-wider px-2 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 transition active:scale-95"
                    >
                      Today
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--c-ink-dim)" }}>
                  {activeTab === "trends" && "Weight Trends & Adaptive TDEE"}
                  {activeTab === "nutrition" && "Micronutrients, Vitamins & Hydration"}
                  {activeTab === "profile" && `${userProfile?.displayName || "Athlete"} · Settings`}
                </p>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Functional Streak Tag */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold shadow-sm"
              style={{
                backgroundColor: "rgba(244, 63, 142, 0.12)",
                borderColor: "rgba(244, 63, 142, 0.28)",
                color: "#F43F8E",
              }}
              title={`${streakInfo.loggedDaysCount} total active days logged`}
            >
              <Flame size={14} className="text-pink-500 fill-pink-500/30" />
              <span>{streakInfo.currentStreak} {streakInfo.currentStreak === 1 ? "Day" : "Days"}</span>
            </div>

            {/* Quick Sun/Moon Theme Toggle */}
            <button
              onClick={() => setIsDark((d) => !d)}
              aria-label="Toggle Theme"
              className="p-2 rounded-full border transition active:scale-95"
              style={{
                backgroundColor: "var(--c-card2)",
                borderColor: "var(--c-line)",
                color: "var(--c-ink)",
              }}
            >
              {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-700" />}
            </button>
          </div>
        </header>

        {/* iOS Add to Home Screen Banner */}
        {showIOSBanner && (
          <div
            className="p-3.5 rounded-2xl border text-xs relative overflow-hidden transition-all shadow-md"
            style={{
              backgroundColor: "var(--c-card2)",
              borderColor: "rgba(244, 63, 142, 0.35)",
            }}
          >
            <button
              type="button"
              onClick={dismissIOSBanner}
              className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-white transition active:scale-90"
              title="Dismiss"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0 mt-0.5">
                <Share2 size={15} />
              </div>
              <div>
                <h4 className="font-extrabold text-[12px] text-pink-400">
                  Install Bento on your iPhone
                </h4>
                <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--c-ink-dim)" }}>
                  Use full-screen without Safari browser bars: tap <span className="font-bold text-pink-400">Share ⎋</span> below, then select <span className="font-bold text-pink-400">Add to Home Screen ➕</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Segment: TODAY (Diary, Calorie Gauge & Meal Logs) ── */}
        {activeTab === "today" && (
          <div className="space-y-6">
            {/* 1. Calorie Hero Ring Card */}
            <CalorieHeroCard
              totals={totals}
              target={settings.calorieTarget}
              activeBurn={activeBurn}
            />

            {/* 2. Macronutrients Card */}
            <MacronutrientsCard totals={totals} settings={settings} />

            {/* 3. Today's Meal Timeline (Meal Logs) */}
            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center px-1">
                <h2
                  className="text-xs font-bold tracking-wide uppercase"
                  style={{ color: "var(--c-ink-dim)" }}
                >
                  Meal Logs
                </h2>
                <button
                  onClick={() => setAddFoodMeal("Lunch")}
                  className="text-xs text-pink-500 font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus size={13} /> Add Food
                </button>
              </div>

              {/* Meals Timeline */}
              {MEALS.map((meal) => {
                const entries = dayEntries.filter((e) => e.meal === meal);
                const mealTotal = entries.reduce((s, e) => s + (e.calories || 0), 0);
                const mealProtein = entries.reduce((s, e) => s + (e.protein || 0), 0);
                const conf = MEAL_CONFIG[meal];
                const itemSummary = entries.map((e) => e.name).join(", ");

                return (
                  <div key={meal} className="bento-card rounded-2xl p-4 transition duration-200">
                    {/* Main Row */}
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setAddFoodMeal(meal)}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-2">
                        <div
                          className="w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0"
                          style={{
                            backgroundColor: "var(--c-card2)",
                            borderColor: "var(--c-line)",
                          }}
                        >
                          {conf.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black leading-none tracking-tight" style={{ color: "var(--c-ink)" }}>
                              {meal}
                            </h3>
                            {mealProtein > 0 && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                                style={{
                                  backgroundColor: "var(--c-macro-pro-dim)",
                                  color: "var(--c-macro-pro)",
                                  border: "1px solid rgba(139, 92, 246, 0.25)",
                                }}
                              >
                                {mealProtein}g P
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-1 truncate" style={{ color: "var(--c-ink-dim)" }}>
                            {itemSummary || "No food logged yet"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black tracking-tight" style={{ color: "var(--c-macro-cal)" }}>
                            {mealTotal} <span className="text-[10px] font-bold" style={{ color: "var(--c-ink-dim)" }}>kcal</span>
                          </p>
                          <p className="text-[11px] font-semibold" style={{ color: "var(--c-ink-dim)" }}>
                            {entries.length} {entries.length === 1 ? "item" : "items"}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddFoodMeal(meal);
                          }}
                          className="p-1.5 rounded-xl border transition active:scale-95 hover:opacity-90"
                          style={{
                            backgroundColor: "var(--c-card2)",
                            borderColor: "var(--c-line)",
                            color: "var(--c-macro-cal)",
                          }}
                          title={`Add food to ${meal}`}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Food Items List */}
                    {entries.length > 0 && (
                      <div
                        className="mt-3 pt-3 border-t space-y-1.5"
                        style={{ borderColor: "var(--c-line)" }}
                      >
                        {entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl border transition"
                            style={{
                              backgroundColor: "var(--c-card2)",
                              borderColor: "var(--c-line)",
                            }}
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold" style={{ color: "var(--c-ink)" }}>
                                {entry.name}
                              </span>
                              <span className="ml-1.5 text-[10px]" style={{ color: "var(--c-ink-dim)" }}>
                                ({entry.servings}x {entry.servingLabel || "serv"})
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className="font-bold text-xs px-2 py-0.5 rounded-lg"
                                style={{
                                  backgroundColor: "rgba(244, 63, 142, 0.12)",
                                  color: "var(--c-macro-cal)",
                                }}
                              >
                                {entry.calories} kcal
                              </span>
                              {entry.protein > 0 && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                  style={{
                                    backgroundColor: "var(--c-macro-pro-dim)",
                                    color: "var(--c-macro-pro)",
                                  }}
                                >
                                  {entry.protein}g P
                                </span>
                              )}
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                className="text-rose-400 hover:text-rose-500 p-1 rounded-lg transition active:scale-95 ml-1"
                                title="Delete entry"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Segment: TRENDS (Scale Weight & Adaptive Expenditure) ── */}
        {activeTab === "trends" && (
          <WeightExpenditureContent
            unit={settings.unit}
            defaultDate={dateStr}
            weights={weights}
            weightSeries={weightSeries}
            expenditure={expenditure}
            onSaveWeight={saveWeightEntry}
            onDeleteWeight={deleteWeightEntry}
          />
        )}

        {/* ── Segment: NUTRITION (Vitamins, Minerals & Hydration) ── */}
        {activeTab === "nutrition" && (
          <NutrientBreakdownContent
            totals={totals}
            targets={nutrientTargets}
            age={settings.age || 25}
            sex={settings.sex || "male"}
            waterMl={currentWater}
            onAddWater={(amt) => saveWater(amt)}
          />
        )}

        {/* ── Segment: PROFILE (Goals, Profile & Settings) ── */}
        {activeTab === "profile" && (
          <ProfileSegmentContent
            settings={settings}
            goalProfile={goalProfile}
            userProfile={userProfile}
            onSaveSettings={saveSettings}
            onSaveUserProfile={saveUserProfile}
            onOpenGoalModal={() => setShowGoal(true)}
            onExportData={handleExportData}
            onImportData={handleImportData}
          />
        )}

        {saveError && (
          <div className="text-center text-xs text-rose-400 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            {saveError}
          </div>
        )}
      </div>

      {/* ── Bottom Floating Action Navigation Dock ── */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[396px] px-3 z-30 pointer-events-none"
        style={{ bottom: "max(var(--sab, 0px) + 0.65rem, 1.15rem)" }}
      >
        <nav
          className="pointer-events-auto rounded-full px-2 py-1.5 flex items-center justify-between border shadow-2xl transition-all duration-300 backdrop-blur-xl"
          style={{
            backgroundColor: "var(--c-nav-bg)",
            borderColor: "var(--c-line)",
          }}
        >
          {/* 1. Today / Dashboard */}
          <button
            onClick={() => setActiveTab("today")}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-200 active:scale-95 ${
              activeTab === "today" ? "font-bold shadow-sm" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: activeTab === "today" ? "rgba(244, 63, 142, 0.16)" : "transparent",
              color: activeTab === "today" ? "var(--c-macro-cal)" : "var(--c-ink-dim)",
              border: activeTab === "today" ? "1px solid rgba(244, 63, 142, 0.3)" : "1px solid transparent",
            }}
            title="Today's Diary"
          >
            <span className="text-lg leading-none">🏠</span>
            <span className="text-[9px] font-black uppercase tracking-tighter leading-none mt-1">Today</span>
          </button>

          {/* 2. Trends / Weight */}
          <button
            onClick={() => setActiveTab("trends")}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-200 active:scale-95 ${
              activeTab === "trends" ? "font-bold shadow-sm" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: activeTab === "trends" ? "rgba(244, 63, 142, 0.16)" : "transparent",
              color: activeTab === "trends" ? "var(--c-macro-cal)" : "var(--c-ink-dim)",
              border: activeTab === "trends" ? "1px solid rgba(244, 63, 142, 0.3)" : "1px solid transparent",
            }}
            title="Weight & Expenditure Trends"
          >
            <span className="text-lg leading-none">📊</span>
            <span className="text-[9px] font-black uppercase tracking-tighter leading-none mt-1">Trends</span>
          </button>

          {/* 3. Center Action Button (Add Food) */}
          <button
            onClick={() => setAddFoodMeal("Lunch")}
            title="Add Food (Camera / Natural Text)"
            className="w-13 h-13 rounded-full bg-pink-500 hover:bg-pink-400 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-pink-500/40 hover:scale-105 active:scale-95 transition-all glow-pink shrink-0"
          >
            +
          </button>

          {/* 4. Complete Micronutrients Breakdown */}
          <button
            onClick={() => setActiveTab("nutrition")}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-200 active:scale-95 ${
              activeTab === "nutrition" ? "font-bold shadow-sm" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: activeTab === "nutrition" ? "rgba(244, 63, 142, 0.16)" : "transparent",
              color: activeTab === "nutrition" ? "var(--c-macro-cal)" : "var(--c-ink-dim)",
              border: activeTab === "nutrition" ? "1px solid rgba(244, 63, 142, 0.3)" : "1px solid transparent",
            }}
            title="Micronutrients & Health"
          >
            <span className="text-lg leading-none">🥗</span>
            <span className="text-[9px] font-black uppercase tracking-tighter leading-none mt-1">Health</span>
          </button>

          {/* 5. Profile & Goals / Settings */}
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-200 active:scale-95 ${
              activeTab === "profile" ? "font-bold shadow-sm" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: activeTab === "profile" ? "rgba(244, 63, 142, 0.16)" : "transparent",
              color: activeTab === "profile" ? "var(--c-macro-cal)" : "var(--c-ink-dim)",
              border: activeTab === "profile" ? "1px solid rgba(244, 63, 142, 0.3)" : "1px solid transparent",
            }}
            title="Goals & Settings"
          >
            <span className="text-lg leading-none">👤</span>
            <span className="text-[9px] font-black uppercase tracking-tighter leading-none mt-1">Profile</span>
          </button>
        </nav>
      </div>

      {/* ── Windows & Modals ── */}
      {/* 1. Full Micronutrient Breakdown Modal */}
      {showNutrientsModal && (
        <NutrientBreakdownModal
          totals={totals}
          targets={nutrientTargets}
          age={settings.age || 25}
          sex={settings.sex || "male"}
          onClose={() => setShowNutrientsModal(false)}
        />
      )}

      {/* 2. Weight & Expenditure Window */}
      {showWeightModal && (
        <WeightExpenditureModal
          unit={settings.unit}
          defaultDate={dateStr}
          weights={weights}
          weightSeries={weightSeries}
          expenditure={expenditure}
          onSaveWeight={saveWeightEntry}
          onDeleteWeight={deleteWeightEntry}
          onClose={() => setShowWeightModal(false)}
        />
      )}

      {/* 3. Add Food Modal */}
      {addFoodMeal && (
        <AddFoodModal
          meal={addFoodMeal}
          foods={foods}
          apiKey={settings.apiKey}
          onAddExisting={(food, servings) => addExistingFoodEntry(addFoodMeal, food, servings)}
          onAddNew={(foodData, servings) => addNewFoodAndLog(addFoodMeal, foodData, servings)}
          onClose={() => setAddFoodMeal(null)}
        />
      )}

      {/* 4. Settings Modal */}
      {showSettings && (
        <SettingsModal settings={settings} onSave={saveSettings} onClose={() => setShowSettings(false)} />
      )}

      {/* 5. Goal Modal */}
      {showGoal && (
        <GoalModal
          settings={settings}
          lastWeightKg={lastWeight ? lastWeight.weight : null}
          expenditure={expenditure}
          savedProfile={goalProfile}
          onApply={saveSettings}
          onSaveProfile={saveGoalProfile}
          onSaveWeight={(kg) => saveWeightEntry(todayStr(), kg)}
          onClose={() => setShowGoal(false)}
        />
      )}

      {/* 6. Calendar Date Selector Modal */}
      {showCalendarModal && (
        <CalendarModal
          selectedDate={dateStr}
          onSelectDate={(d) => setDateStr(d)}
          loggedDates={loggedDates}
          onClose={() => setShowCalendarModal(false)}
        />
      )}
    </div>
  );
}
