"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  supabase,
  type ProfileRow as Profile,
  type TransactionRow as Transaction,
} from "@/src/infrastructure/supabase/supabase";
import BottomNavigation from "@/components/BottomNavigation";
import {
  getCurrentBalance,
  getFinancialStatus,
  getTodayExpense,
  getTodayVsAvgPercent,
  getTopExpenseCategories,
  getRecentBigExpenses,
  getMonthRange,
} from "@/src/domain/finance/finance";
import {
  getActivePeriodMonth,
  getRemainingDaysInPeriod,
} from "@/src/domain/period/period";
import {
  computeVariableDailyRate,
  computePlannedRemaining,
  computeForecastEnd,
} from "@/src/domain/forecast/forecast";
import RecentBigExpenses from "./components/RecentBigExpenses";
import CategoryIcon from "@/components/CategoryIcon";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  eachMonthOfInterval,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  subDays,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  subWeeks,
  startOfYear,
  endOfYear,
  eachYearOfInterval,
  subYears,
} from "date-fns";
import { th } from "date-fns/locale";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [chartPeriod, setChartPeriod] = useState<
    "daily" | "weekly" | "monthly" | "yearly"
  >("daily");
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    income: number;
    expense: number;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredCumulativePoint, setHoveredCumulativePoint] = useState<{
    label: string;
    sum: number;
    x: number;
    y: number;
  } | null>(null);
  const initialMonthSetRef = useRef(false);

  const checkUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/auth/login");
      return;
    }
    setUser(session.user);
    // Don't call loadProfile here - it will be called in useEffect
  }, [router]);

  const loadProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("Error loading profile:", profileError);
      } else if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthData = useCallback(
    async (month: Date, monthEndDayVal: number) => {
      if (!user) return;

      try {
        const { start, end } = getMonthRange(month, monthEndDayVal);

        const { data: transactionsData, error: transactionsError } =
          await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .gte("date", format(start, "yyyy-MM-dd"))
            .lte("date", format(end, "yyyy-MM-dd"))
            .order("date", { ascending: false });

        if (transactionsError) {
          console.error("Error loading transactions:", transactionsError);
        } else if (transactionsData) {
          setTransactions(transactionsData);
          const income = transactionsData
            .filter((t) => t.type === "income")
            .reduce((sum, t) => sum + Number(t.amount), 0);
          const expense = transactionsData
            .filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + Number(t.amount), 0);
          setTotalIncome(income);
          setTotalExpense(expense);
        }
      } catch (error) {
        console.error("Error loading month data:", error);
      }
    },
    [user],
  );

  const loadAllTransactions = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) {
        console.error("Error loading all transactions:", error);
      } else {
        setAllTransactions(data || []);
      }
    } catch (error) {
      console.error("Error loading all transactions:", error);
    }
  }, [user]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  useEffect(() => {
    if (user) {
      loadProfile(user.id);
    }
  }, [user]);

  const monthEndDay = profile?.month_end_day ?? 0;

  useEffect(() => {
    if (!initialMonthSetRef.current && profile != null) {
      const now = new Date();
      const activeMonth = getActivePeriodMonth(now, profile.month_end_day ?? 0);
      setSelectedMonth(activeMonth);
      initialMonthSetRef.current = true;
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      loadMonthData(selectedMonth, monthEndDay);
      loadAllTransactions();
    }
  }, [user, selectedMonth, monthEndDay, loadMonthData, loadAllTransactions]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    const onFocus = () => loadProfile(user.id);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const changeMonth = (direction: "prev" | "next") => {
    const newMonth = new Date(selectedMonth);
    if (direction === "prev") {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setSelectedMonth(newMonth);
  };

  // คำนวณกราฟตามช่วงเวลา
  const getTrendData = () => {
    const now = new Date();
    const monthNames = [
      "ม.ค.",
      "ก.พ.",
      "มี.ค.",
      "เม.ย.",
      "พ.ค.",
      "มิ.ย.",
      "ก.ค.",
      "ส.ค.",
      "ก.ย.",
      "ต.ค.",
      "พ.ย.",
      "ธ.ค.",
    ];

    switch (chartPeriod) {
      case "daily": {
        // รายวัน - 30 วันล่าสุด
        const thirtyDaysAgo = subDays(now, 29);
        const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now });

        return days
          .map((day) => {
            const dayStart = startOfDay(day);
            const dayEnd = endOfDay(day);

            const dayTransactions = allTransactions.filter((t) => {
              const tDate = new Date(t.date);
              if (isNaN(tDate.getTime())) return false;
              return tDate >= dayStart && tDate <= dayEnd;
            });

            const income = dayTransactions
              .filter((t) => t.type === "income")
              .reduce((sum, t) => sum + Number(t.amount), 0);

            const expense = dayTransactions
              .filter((t) => t.type === "expense")
              .reduce((sum, t) => sum + Number(t.amount), 0);

            return {
              label: format(day, "dd/MM"),
              labelShort: format(day, "dd"),
              income,
              expense,
            };
          })
          .filter((d) => d.income > 0 || d.expense > 0);
      }

      case "weekly": {
        // รายสัปดาห์ - 12 สัปดาห์ล่าสุด
        const twelveWeeksAgo = subWeeks(now, 11);
        const weeks = eachWeekOfInterval(
          { start: twelveWeeksAgo, end: now },
          { weekStartsOn: 1 },
        );

        return weeks
          .map((week) => {
            const weekStart = startOfWeek(week, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(week, { weekStartsOn: 1 });

            const weekTransactions = allTransactions.filter((t) => {
              const tDate = new Date(t.date);
              if (isNaN(tDate.getTime())) return false;
              return tDate >= weekStart && tDate <= weekEnd;
            });

            const income = weekTransactions
              .filter((t) => t.type === "income")
              .reduce((sum, t) => sum + Number(t.amount), 0);

            const expense = weekTransactions
              .filter((t) => t.type === "expense")
              .reduce((sum, t) => sum + Number(t.amount), 0);

            return {
              label: `${format(weekStart, "dd/MM")} - ${format(weekEnd, "dd/MM")}`,
              labelShort: format(weekStart, "dd/MM"),
              income,
              expense,
            };
          })
          .filter((d) => d.income > 0 || d.expense > 0);
      }

      case "monthly": {
        // รายเดือน - 12 เดือนล่าสุด
        const twelveMonthsAgo = subMonths(now, 11);
        const months = eachMonthOfInterval({
          start: twelveMonthsAgo,
          end: now,
        });

        return months
          .map((month) => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);

            const monthTransactions = allTransactions.filter((t) => {
              const tDate = new Date(t.date);
              if (isNaN(tDate.getTime())) return false;
              return tDate >= monthStart && tDate <= monthEnd;
            });

            const income = monthTransactions
              .filter((t) => t.type === "income")
              .reduce((sum, t) => sum + Number(t.amount), 0);

            const expense = monthTransactions
              .filter((t) => t.type === "expense")
              .reduce((sum, t) => sum + Number(t.amount), 0);

            return {
              label: `${monthNames[month.getMonth()]} ${month.getFullYear()}`,
              labelShort: monthNames[month.getMonth()],
              income,
              expense,
            };
          })
          .filter((d) => d.income > 0 || d.expense > 0);
      }

      case "yearly": {
        // รายปี - 5 ปีล่าสุด
        const fiveYearsAgo = subYears(now, 4);
        const years = eachYearOfInterval({ start: fiveYearsAgo, end: now });

        return years
          .map((year) => {
            const yearStart = startOfYear(year);
            const yearEnd = endOfYear(year);

            const yearTransactions = allTransactions.filter((t) => {
              const tDate = new Date(t.date);
              if (isNaN(tDate.getTime())) return false;
              return tDate >= yearStart && tDate <= yearEnd;
            });

            const income = yearTransactions
              .filter((t) => t.type === "income")
              .reduce((sum, t) => sum + Number(t.amount), 0);

            const expense = yearTransactions
              .filter((t) => t.type === "expense")
              .reduce((sum, t) => sum + Number(t.amount), 0);

            return {
              label: `${year.getFullYear()}`,
              labelShort: `${year.getFullYear()}`,
              income,
              expense,
            };
          })
          .filter((d) => d.income > 0 || d.expense > 0);
      }
    }
  };

  const trendData = getTrendData();
  const maxTrendValue = Math.max(
    ...trendData.map((d) => Math.max(d.income, d.expense)),
    1,
  );
  const trendWithNet = trendData.map((d) => ({
    ...d,
    net: d.income - d.expense,
  }));
  const maxAbsNet = Math.max(...trendWithNet.map((d) => Math.abs(d.net)), 1);
  const cumulativeNet = trendWithNet.reduce<
    { sum: number; label: string; labelShort: string }[]
  >(
    (acc, d, i) => [
      ...acc,
      {
        sum: (acc[i - 1]?.sum ?? 0) + d.net,
        label: d.label,
        labelShort: d.labelShort,
      },
    ],
    [],
  );
  const maxAbsCumulative = Math.max(
    ...cumulativeNet.map((c) => Math.abs(c.sum)),
    1,
  );

  // Plot area (SVG coords) – ใช้ normalize ความสูงแท่งและเส้น
  const PLOT_X_MIN = 10;
  const PLOT_X_MAX = 390;
  const PLOT_WIDTH = PLOT_X_MAX - PLOT_X_MIN;
  const PLOT_Y_TOP = 10;
  const PLOT_Y_BOTTOM = 110;
  const PLOT_HEIGHT = PLOT_Y_BOTTOM - PLOT_Y_TOP;
  const NET_BASELINE_Y = PLOT_Y_TOP + PLOT_HEIGHT / 2;
  const NET_HALF_RANGE = PLOT_HEIGHT / 2;

  const monthNames = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const currentMonthName = monthNames[selectedMonth.getMonth()];
  const currentYear = selectedMonth.getFullYear() + 543; // Convert to Buddhist year

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 pb-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const monthRange = getMonthRange(selectedMonth, monthEndDay);
  const nowDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startDate = new Date(
    monthRange.start.getFullYear(),
    monthRange.start.getMonth(),
    monthRange.start.getDate(),
  ).getTime();
  const endDate = new Date(
    monthRange.end.getFullYear(),
    monthRange.end.getMonth(),
    monthRange.end.getDate(),
  ).getTime();
  const isViewingCurrentMonth = nowDate >= startDate && nowDate <= endDate;
  const remainingDays = getRemainingDaysInPeriod(now, monthRange);
  const currentBalance = getCurrentBalance(totalIncome, totalExpense);

  const txLike = allTransactions.map((t) => ({
    type: t.type as "income" | "expense",
    amount: Number(t.amount),
    category: t.category ?? undefined,
    date: t.date,
  }));
  const variableDailyRate = computeVariableDailyRate(txLike, now);
  const plannedRemaining = computePlannedRemaining(
    txLike,
    now,
    monthRange.start,
    monthRange.end,
  );
  const forecast = computeForecastEnd(
    currentBalance,
    variableDailyRate,
    plannedRemaining,
    remainingDays,
  );
  const projectedBalance = forecast.forecastEnd;
  const daysLeft =
    variableDailyRate > 0
      ? currentBalance / variableDailyRate
      : currentBalance >= 0
        ? Infinity
        : 0;
  const financialStatus = getFinancialStatus(
    projectedBalance,
    daysLeft,
    remainingDays,
  );
  const todayStr = format(now, "yyyy-MM-dd");
  const todayExpense = isViewingCurrentMonth
    ? getTodayExpense(transactions, todayStr)
    : 0;
  const todayVsAvgPercent = getTodayVsAvgPercent(
    todayExpense,
    variableDailyRate,
  );
  const topCategories = getTopExpenseCategories(transactions, 3);
  const recentBigExpenses = getRecentBigExpenses(transactions, 5);

  const spendingPercentOfIncome =
    totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
  const spendingBarOver80 = spendingPercentOfIncome > 80;

  function getRecommendation(): string {
    if (financialStatus === "Risk") {
      return "คาดการณ์ปลายเดือนอาจติดลบ ลองลดรายจ่ายหรือหารายได้เสริม";
    }
    if (financialStatus === "Warning") {
      return "ยอดคงเหลืออาจไม่พอถึงปลายเดือน ลดรายจ่ายผันแปรวันละนิดก็ช่วยได้";
    }
    const top = topCategories[0];
    if (top && totalIncome > 0) {
      const topPercentOfIncome = (top.total / totalIncome) * 100;
      if (top.category === "ที่พัก/ค่าเช่า" && topPercentOfIncome > 40) {
        return "ค่าเช่ากินงบเกินครึ่ง ลองตั้งเป้าไม่เกิน 40% ของรายได้";
      }
      if (top.category === "อาหาร" && top.percent > 35) {
        return "ค่าใช้จ่ายอาหารสูงกว่าปกติ ลองลดลงวันละ 50 บาท";
      }
    }
    if (financialStatus === "Healthy") {
      return "สถานะดีนะ ใช้จ่ายตามแผนต่อได้";
    }
    return "";
  }
  const recommendation = getRecommendation();

  /** One-line coach tip for hero (e.g. "ถ้าลดค่าอาหารวันละ 50 บาท จะรอดเดือนนี้") */
  function getShortTip(): string {
    if (financialStatus === "Risk")
      return "ลองลดรายจ่ายหรือหารายได้เสริมจะช่วยได้";
    if (financialStatus === "Warning")
      return "ลดรายจ่ายผันแปรวันละนิดก็ช่วยได้";
    const top = topCategories[0];
    if (top && totalIncome > 0) {
      if (top.category === "อาหาร" && top.total > 0)
        return "ถ้าลดค่าอาหารวันละ 50 บาท จะรอดเดือนนี้";
      if (top.category === "ที่พัก/ค่าเช่า")
        return "ลองตั้งเป้าค่าเช่าไม่เกิน 40% ของรายได้";
    }
    if (financialStatus === "Healthy") return "ใช้จ่ายตามแผนต่อได้";
    return "ติดตามรายจ่ายทุกวันช่วยคุมงบได้ดี";
  }

  const shortTip = getShortTip();

  // Debt & savings summary (same simple logic as debt-goal / savings-goal pages)
  const totalDebt = profile?.total_liabilities ?? 0;
  const monthlyDebtPayment = profile?.monthly_debt_payment ?? 0;
  const monthsToPayoff =
    monthlyDebtPayment > 0 && totalDebt > 0
      ? Math.ceil(totalDebt / monthlyDebtPayment)
      : 0;
  const payoffDate =
    monthlyDebtPayment > 0 && totalDebt > 0
      ? addMonths(now, monthsToPayoff)
      : null;
  const initialDebtEstimate = totalDebt > 0 ? totalDebt * 1.2 : 0;
  const debtPaidPercent =
    initialDebtEstimate > 0
      ? Math.min(
          99,
          Math.round(((initialDebtEstimate - totalDebt) / initialDebtEstimate) * 100),
        )
      : 0;

  const currentSaved = profile?.liquid_assets ?? 0;
  const monthlySaving = profile?.saving ?? 0;
  const targetSavings =
    currentSaved > 0 ? Math.max(currentSaved * 2, 100000) : 200000;
  const savingsProgressPercent =
    targetSavings > 0
      ? Math.min(100, Math.round((currentSaved / targetSavings) * 100))
      : 0;
  const monthsToGoal =
    monthlySaving > 0 && currentSaved < targetSavings
      ? Math.ceil((targetSavings - currentSaved) / monthlySaving)
      : 0;
  const savingsGoalDate =
    monthlySaving > 0 && currentSaved < targetSavings
      ? addMonths(now, monthsToGoal)
      : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white text-gray-800 px-4 py-3 flex justify-between items-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800">ภาพรวม</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            title="ออกจากระบบ"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        {/* Month Selector */}
        <div className="bg-white text-gray-800 px-4 py-3 rounded-2xl shadow-sm mb-5 flex items-center justify-between">
          <button
            onClick={() => changeMonth("prev")}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span className="font-medium text-gray-800">
            {currentMonthName} {currentYear}
          </span>
          <button
            onClick={() => changeMonth("next")}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Section 1: Monthly Status (Hero) */}
        <div className="mb-5">
          {(() => {
            const isHealthy = financialStatus === "Healthy";
            const isWarning = financialStatus === "Warning";
            const isRisk = financialStatus === "Risk";
            const heroLabel = isHealthy
              ? "เดือนนี้ปลอดภัย"
              : isWarning
                ? "ต้องระวังการใช้เงิน"
                : "มีโอกาสติดลบ";
            const heroBg = isHealthy
              ? "bg-emerald-50"
              : isWarning
                ? "bg-amber-50"
                : "bg-red-50";
            const heroDot = isHealthy ? "🟢" : isWarning ? "🟡" : "🔴";
            const heroText = isHealthy
              ? "text-emerald-800"
              : isWarning
                ? "text-amber-800"
                : "text-red-800";
            return (
              <div className={`rounded-2xl p-6 ${heroBg} shadow-sm`}>
                <p
                  className={`text-xl font-bold ${heroText} flex items-center gap-2`}
                >
                  <span>{heroDot}</span>
                  {heroLabel}
                </p>
                {shortTip && (
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                    {shortTip}
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* Section 2: Three Main Cards */}
        <div className="space-y-4 mb-5">
          {/* Card 1 — Spending Control */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💸</span>
              <h2 className="text-sm font-medium text-gray-600">
                ควบคุมรายจ่าย
              </h2>
            </div>
            {totalIncome > 0 ? (
              <>
                <p className="text-2xl font-bold text-gray-900">
                  {spendingPercentOfIncome.toFixed(0)}%{" "}
                  <span className="text-base font-medium text-gray-500">
                    ของรายได้
                  </span>
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  ใช้จ่ายไปแล้วในเดือนนี้
                </p>
                {monthEndDay !== 0 && (
                  <p className="text-xs text-gray-400 mb-1" title="ช่วงงวดที่ใช้คำนวณ">
                    งวด {format(monthRange.start, "d MMM", { locale: th })} – {format(monthRange.end, "d MMM yyyy", { locale: th })}
                  </p>
                )}
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${spendingBarOver80 ? "bg-red-400" : "bg-amber-300"}`}
                    style={{
                      width: `${Math.min(spendingPercentOfIncome, 100)}%`,
                    }}
                  />
                </div>
                {topCategories[0] && (
                  <p className="text-sm text-gray-600 mb-3">
                    หมวดที่ใช้มาก:{" "}
                    <span className="font-medium text-gray-800">
                      {topCategories[0].category}
                    </span>
                  </p>
                )}
                <Link
                  href="#"
                  className="block w-full py-2.5 px-3 rounded-xl text-sm font-medium text-center bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100/80 transition-colors"
                >
                  ดูวิธีลดรายจ่าย
                </Link>
              </>
            ) : (
              <p className="text-sm text-gray-500 mb-3">
                ยังไม่มีข้อมูลรายได้ในเดือนนี้
              </p>
            )}
          </div>

          {/* Card 2 — Debt Goal */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💳</span>
              <h2 className="text-sm font-medium text-gray-600">เป้าปลดหนี้</h2>
            </div>
            {totalDebt > 0 ? (
              <>
                <p className="text-2xl font-bold text-gray-900">
                  {totalDebt.toLocaleString("th-TH")}{" "}
                  <span className="text-base font-medium text-gray-500">
                    บาท
                  </span>
                </p>
                <p className="text-xs text-gray-500 mb-1">ยอดหนี้คงเหลือ</p>
                {debtPaidPercent > 0 && (
                  <p className="text-sm text-emerald-600 font-medium mb-2">
                    ปลดแล้วประมาณ {debtPaidPercent}% <span className="text-gray-500 font-normal text-xs">(ประมาณการจากยอดคงเหลือ)</span>
                  </p>
                )}
                {payoffDate && (
                  <p className="text-sm text-gray-600 mb-3">
                    คาดหมดหนี้ {format(payoffDate, "MMM yyyy")}
                  </p>
                )}
                <Link
                  href="/debt-goal"
                  className="block w-full py-2.5 px-3 rounded-xl text-sm font-medium text-center bg-emerald-50 text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100/80 transition-colors"
                >
                  ดูแผนปลดหนี้
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  ยังไม่มีหนี้ที่บันทึก
                </p>
                <Link
                  href="/debt-goal"
                  className="block w-full py-2.5 px-3 rounded-xl text-sm font-medium text-center bg-emerald-50 text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100/80 transition-colors"
                >
                  ดูแผนปลดหนี้
                </Link>
              </>
            )}
          </div>

          {/* Card 3 — Savings Goal */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💰</span>
              <h2 className="text-sm font-medium text-gray-600">เป้าออมเงิน</h2>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {currentSaved.toLocaleString("th-TH")}{" "}
              <span className="text-base font-medium text-gray-500">
                / {targetSavings.toLocaleString("th-TH")} บาท
              </span>
            </p>
            <p className="text-xs text-gray-500 mb-2">เก็บได้แล้ว / เป้าหมาย</p>
            <p className="text-xs text-gray-400 mb-1">จากยอดสภาพคล่องในโปรไฟล์ และเป้าหมายที่ตั้ง</p>
            <p className="text-sm text-sky-600 font-medium mb-2">
              ความคืบหน้า {savingsProgressPercent}%
            </p>
            {savingsGoalDate && currentSaved < targetSavings && (
              <p className="text-sm text-gray-600 mb-3">
                คาดถึงเป้า {format(savingsGoalDate, "MMM yyyy")}
              </p>
            )}
            <Link
              href="/savings-goal"
              className="block w-full py-2.5 px-3 rounded-xl text-sm font-medium text-center bg-sky-50 text-sky-800 border border-sky-200/60 hover:bg-sky-100/80 transition-colors"
            >
              ดูแผนออมเงิน
            </Link>
          </div>
        </div>

        {/* Section 3: Today Performance */}
        {isViewingCurrentMonth && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📈</span>
              <h2 className="text-sm font-medium text-gray-600">วันนี้</h2>
            </div>
            {variableDailyRate > 0 ? (
              todayExpense <= variableDailyRate ? (
                <p className="text-lg font-semibold text-emerald-600">
                  วันนี้คุมเงินได้ดี
                </p>
              ) : (
                <p className="text-lg font-semibold text-amber-600">
                  วันนี้ใช้เกินปกติ{" "}
                  {Math.round(todayExpense - variableDailyRate).toLocaleString(
                    "th-TH",
                  )}{" "}
                  บาท
                </p>
              )
            ) : (
              <p className="text-sm text-gray-500">ยังไม่มีข้อมูลพอเทียบ</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              เทียบกับค่าใช้จ่ายผันแปรเฉลี่ยต่อวัน
            </p>
          </div>
        )}

        {/* Section 4: Smart Tips */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💡</span>
            <h2 className="text-sm font-medium text-gray-600">คำแนะนำ</h2>
          </div>
          {(() => {
            const tips: string[] = [];
            if (recommendation) tips.push(recommendation);
            if (
              totalIncome > 0 &&
              totalExpense / totalIncome > 0.8 &&
              !recommendation?.includes("ลดรายจ่าย")
            ) {
              tips.push("รายจ่ายเกิน 80% ของรายได้ ลองลดหมวดที่ไม่จำเป็นก่อน");
            }
            if (
              monthlySaving > 0 &&
              totalIncome > 0 &&
              (monthlySaving / totalIncome) * 100 < 10 &&
              tips.length < 2
            ) {
              tips.push(
                "เก็บออมอย่างน้อย 10% ของรายได้จะช่วยสร้างนิสัยการออมได้ดี",
              );
            }
            if (tips.length === 0) tips.push("ทำได้ดีนะ ใช้จ่ายตามแผนต่อได้");
            return (
              <ul className="space-y-2">
                {tips.slice(0, 2).map((t, i) => (
                  <li key={i} className="text-sm text-gray-700 leading-relaxed">
                    • {t}
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>

        {/* Link to AI Analysis */}
        <Link
          href="/ai-analysis"
          className="block mb-5 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 hover:from-blue-100 hover:to-indigo-100 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-medium text-gray-800">วิเคราะห์การเงินด้วย AI</h3>
              <p className="text-sm text-gray-600">ให้ AI วิเคราะห์จากรายรับรายจ่ายของคุณ</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* 5) Income vs Expense Trend (Behavior Chart) */}
        {trendData.length > 0 &&
          (() => {
            const n = trendData.length;
            const bandWidth = n > 1 ? PLOT_WIDTH / n : PLOT_WIDTH;
            const gap = 4;
            const barWidth = (bandWidth - gap) / 2;
            const BAR_COLOR_INCOME = "#10b981";
            const BAR_COLOR_EXPENSE = "#ef4444";
            const NET_LINE_COLOR = "#6366f1";
            const BASELINE_COLOR = "#9ca3af";

            return (
              <div className="bg-white p-4 rounded-2xl shadow-sm mb-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-gray-600">
                    แนวโน้มรายรับรายจ่าย
                  </h3>
                  <select
                    value={chartPeriod}
                    onChange={(e) =>
                      setChartPeriod(
                        e.target.value as
                          | "daily"
                          | "weekly"
                          | "monthly"
                          | "yearly",
                      )
                    }
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="daily">รายวัน (30 วัน)</option>
                    <option value="weekly">รายสัปดาห์ (12 สัปดาห์)</option>
                    <option value="monthly">รายเดือน (12 เดือน)</option>
                    <option value="yearly">รายปี (5 ปี)</option>
                  </select>
                </div>
                <div
                  className="h-40 relative"
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <svg
                    className="w-full h-full"
                    viewBox="-10 -10 420 140"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Grid lines */}
                    {[0, 30, 60, 90, 120].map((y) => (
                      <line
                        key={y}
                        x1={PLOT_X_MIN}
                        y1={10 + y}
                        x2={PLOT_X_MAX}
                        y2={10 + y}
                        stroke="#e5e7eb"
                        strokeWidth="0.5"
                      />
                    ))}

                    {/* Baseline 0 (สุทธิ) */}
                    <line
                      x1={PLOT_X_MIN}
                      y1={NET_BASELINE_Y}
                      x2={PLOT_X_MAX}
                      y2={NET_BASELINE_Y}
                      stroke={BASELINE_COLOR}
                      strokeWidth="0.8"
                      strokeDasharray="4 2"
                    />

                    {/* Grouped bars */}
                    {trendWithNet.map((d, i) => {
                      const bandLeft = PLOT_X_MIN + i * bandWidth;
                      const bandCenter = bandLeft + bandWidth / 2;
                      const incomeBarX = bandCenter - barWidth - gap / 2;
                      const expenseBarX = bandCenter + gap / 2;
                      const incomeHeight =
                        (d.income / maxTrendValue) * PLOT_HEIGHT;
                      const expenseHeight =
                        (d.expense / maxTrendValue) * PLOT_HEIGHT;
                      return (
                        <g key={i}>
                          <rect
                            x={incomeBarX}
                            y={PLOT_Y_BOTTOM - incomeHeight}
                            width={barWidth}
                            height={incomeHeight}
                            fill={BAR_COLOR_INCOME}
                            rx="2"
                          />
                          <rect
                            x={expenseBarX}
                            y={PLOT_Y_BOTTOM - expenseHeight}
                            width={barWidth}
                            height={expenseHeight}
                            fill={BAR_COLOR_EXPENSE}
                            rx="2"
                          />
                        </g>
                      );
                    })}

                    {/* Net line (polyline) */}
                    {trendWithNet.length > 0 && (
                      <polyline
                        points={trendWithNet
                          .map((d, i) => {
                            const x =
                              n > 1
                                ? PLOT_X_MIN + (i / (n - 1)) * PLOT_WIDTH
                                : PLOT_X_MIN + PLOT_WIDTH / 2;
                            const netNorm = d.net / maxAbsNet;
                            const y = NET_BASELINE_Y - netNorm * NET_HALF_RANGE;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                        fill="none"
                        stroke={NET_LINE_COLOR}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {trendWithNet.length > 0 &&
                      trendWithNet.map((d, i) => {
                        const x =
                          n > 1
                            ? PLOT_X_MIN + (i / (n - 1)) * PLOT_WIDTH
                            : PLOT_X_MIN + PLOT_WIDTH / 2;
                        const netNorm = d.net / maxAbsNet;
                        const y = NET_BASELINE_Y - netNorm * NET_HALF_RANGE;
                        return (
                          <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="3"
                            fill={NET_LINE_COLOR}
                            stroke="white"
                            strokeWidth="1.5"
                            style={{ pointerEvents: "none" }}
                          />
                        );
                      })}

                    {/* Hover areas (invisible rect per band) */}
                    {trendWithNet.map((d, i) => {
                      const bandLeft = PLOT_X_MIN + i * bandWidth;
                      const net = d.income - d.expense;
                      const tooltipYPercent = net >= 0 ? 25 : 75;
                      return (
                        <rect
                          key={i}
                          x={bandLeft}
                          y={PLOT_Y_TOP}
                          width={bandWidth}
                          height={PLOT_HEIGHT}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => {
                            const xPercent =
                              ((bandLeft + bandWidth / 2 - PLOT_X_MIN) /
                                PLOT_WIDTH) *
                              100;
                            setHoveredPoint({
                              label: d.label,
                              income: d.income,
                              expense: d.expense,
                              x: xPercent,
                              y: tooltipYPercent,
                            });
                          }}
                        />
                      );
                    })}
                  </svg>

                  {/* Tooltip */}
                  {hoveredPoint && (
                    <div
                      className="absolute bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none"
                      style={{
                        left: `${hoveredPoint.x}%`,
                        top: `${hoveredPoint.y}%`,
                        transform: "translate(-50%, -100%)",
                        marginTop: "-8px",
                        minWidth: "140px",
                      }}
                    >
                      <div className="font-semibold mb-2 text-center border-b border-gray-700 pb-1">
                        {hoveredPoint.label}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm bg-green-500" />
                            <span>รายรับ</span>
                          </div>
                          <span className="font-medium">
                            {hoveredPoint.income.toLocaleString("th-TH")} บาท
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm bg-red-500" />
                            <span>รายจ่าย</span>
                          </div>
                          <span className="font-medium">
                            {hoveredPoint.expense.toLocaleString("th-TH")} บาท
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-700">
                          <span className="text-gray-300">สุทธิ</span>
                          <span
                            className={`font-semibold ${hoveredPoint.income - hoveredPoint.expense >= 0 ? "text-green-400" : "text-red-400"}`}
                          >
                            {(
                              hoveredPoint.income - hoveredPoint.expense
                            ).toLocaleString("th-TH")}{" "}
                            บาท
                          </span>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                        <div className="border-4 border-transparent border-t-gray-800" />
                      </div>
                    </div>
                  )}

                  {/* X labels */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 px-1">
                    {trendData.map((d, i) => (
                      <span key={i} className="text-xs">
                        {d.labelShort}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-4 mt-3 pt-3 border-t border-gray-200 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-2.5 rounded-sm bg-green-500" />
                    <span className="text-sm text-gray-600">รายรับ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-2.5 rounded-sm bg-red-500" />
                    <span className="text-sm text-gray-600">รายจ่าย</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-0.5 rounded-full"
                      style={{ background: NET_LINE_COLOR }}
                    />
                    <span className="text-sm text-gray-600">สุทธิ</span>
                  </div>
                </div>

                {/* คงเหลือสะสมในช่วง */}
                {cumulativeNet.length > 0 &&
                  (() => {
                    const cumN = cumulativeNet.length;
                    const cumBandWidth =
                      cumN > 1 ? PLOT_WIDTH / cumN : PLOT_WIDTH;
                    return (
                      <div
                        className="mt-4 pt-4 border-t border-gray-200"
                        onMouseLeave={() => setHoveredCumulativePoint(null)}
                      >
                        <h4 className="text-xs font-semibold text-gray-600 mb-2">
                          คงเหลือสะสมในช่วง
                        </h4>
                        <div className="h-[120px] relative">
                          <svg
                            className="w-full h-full"
                            viewBox="-10 -10 420 140"
                            preserveAspectRatio="xMidYMid meet"
                          >
                            {[0, 30, 60, 90, 120].map((y) => (
                              <line
                                key={y}
                                x1={PLOT_X_MIN}
                                y1={10 + y}
                                x2={PLOT_X_MAX}
                                y2={10 + y}
                                stroke="#e5e7eb"
                                strokeWidth="0.5"
                              />
                            ))}
                            <line
                              x1={PLOT_X_MIN}
                              y1={NET_BASELINE_Y}
                              x2={PLOT_X_MAX}
                              y2={NET_BASELINE_Y}
                              stroke={BASELINE_COLOR}
                              strokeWidth="0.8"
                              strokeDasharray="4 2"
                            />
                            <polyline
                              points={cumulativeNet
                                .map((c, i) => {
                                  const x =
                                    cumN > 1
                                      ? PLOT_X_MIN +
                                        (i / (cumN - 1)) * PLOT_WIDTH
                                      : PLOT_X_MIN + PLOT_WIDTH / 2;
                                  const norm =
                                    maxAbsCumulative > 0
                                      ? c.sum / maxAbsCumulative
                                      : 0;
                                  const y =
                                    NET_BASELINE_Y - norm * NET_HALF_RANGE;
                                  return `${x},${y}`;
                                })
                                .join(" ")}
                              fill="none"
                              stroke={NET_LINE_COLOR}
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {cumulativeNet.map((c, i) => {
                              const x =
                                cumN > 1
                                  ? PLOT_X_MIN + (i / (cumN - 1)) * PLOT_WIDTH
                                  : PLOT_X_MIN + PLOT_WIDTH / 2;
                              const norm =
                                maxAbsCumulative > 0
                                  ? c.sum / maxAbsCumulative
                                  : 0;
                              const y = NET_BASELINE_Y - norm * NET_HALF_RANGE;
                              return (
                                <circle
                                  key={i}
                                  cx={x}
                                  cy={y}
                                  r="2.5"
                                  fill={NET_LINE_COLOR}
                                  style={{ pointerEvents: "none" }}
                                />
                              );
                            })}
                            {/* Hover areas for cumulative tooltip */}
                            {cumulativeNet.map((c, i) => {
                              const bandLeft = PLOT_X_MIN + i * cumBandWidth;
                              const xPercent =
                                ((bandLeft + cumBandWidth / 2 - PLOT_X_MIN) /
                                  PLOT_WIDTH) *
                                100;
                              const yPercent = 40;
                              return (
                                <rect
                                  key={i}
                                  x={bandLeft}
                                  y={PLOT_Y_TOP}
                                  width={cumBandWidth}
                                  height={PLOT_HEIGHT}
                                  fill="transparent"
                                  style={{ cursor: "pointer" }}
                                  onMouseEnter={() =>
                                    setHoveredCumulativePoint({
                                      label: c.label,
                                      sum: c.sum,
                                      x: xPercent,
                                      y: yPercent,
                                    })
                                  }
                                />
                              );
                            })}
                          </svg>
                          {hoveredCumulativePoint && (
                            <div
                              className="absolute bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none"
                              style={{
                                left: `${hoveredCumulativePoint.x}%`,
                                top: `${hoveredCumulativePoint.y}%`,
                                transform: "translate(-50%, -100%)",
                                marginTop: "-8px",
                                minWidth: "120px",
                              }}
                            >
                              <div className="font-semibold mb-1 text-center border-b border-gray-700 pb-1">
                                {hoveredCumulativePoint.label}
                              </div>
                              <div className="flex items-center justify-between gap-3 pt-1">
                                <span className="text-gray-300">สะสม</span>
                                <span
                                  className={`font-semibold ${hoveredCumulativePoint.sum >= 0 ? "text-green-400" : "text-red-400"}`}
                                >
                                  {hoveredCumulativePoint.sum.toLocaleString(
                                    "th-TH",
                                  )}{" "}
                                  บาท
                                </span>
                              </div>
                              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                <div className="border-4 border-transparent border-t-gray-800" />
                              </div>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 px-1">
                            {cumulativeNet.map((c, i) => (
                              <span key={i} className="text-xs">
                                {c.labelShort}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            );
          })()}

        {/* 6) Recent Big Expenses */}
        <div className="mb-5">
          <RecentBigExpenses items={recentBigExpenses} />
        </div>

        {/* Latest Transactions */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-600">รายการล่าสุด</h3>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              ยังไม่มีรายการในเดือนนี้
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <CategoryIcon category={transaction.category || ""} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {transaction.category || "-"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(transaction.date), "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      transaction.type === "income"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {Number(transaction.amount).toLocaleString("th-TH")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
