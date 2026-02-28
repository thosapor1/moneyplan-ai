"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  supabase,
  type ProfileRow as Profile,
  type TransactionRow as Transaction,
} from "@/src/infrastructure/supabase/supabase";
import BottomNavigation from "@/components/BottomNavigation";
import MonthSelector from "@/components/MonthSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { getDailySpendingForPeriod } from "@/lib/chart-data";
import CategoryIcon from "@/components/CategoryIcon";
import {
  TrendingUpIcon,
  WalletIcon,
  CreditCardIcon,
  SparklesIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { format, addMonths } from "date-fns";
import { th } from "date-fns/locale";

const formatCurrency = (n: number) => n.toLocaleString("th-TH");

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

  const monthEndDay = 0

  useEffect(() => {
    if (!user) return;
    if (!initialMonthSetRef.current && profile != null) {
      const activeMonth = getActivePeriodMonth(new Date(), 0);
      setSelectedMonth(activeMonth);
      initialMonthSetRef.current = true;
      return;
    }
    loadMonthData(selectedMonth, monthEndDay);
    loadAllTransactions();
  }, [user, profile, selectedMonth, monthEndDay, loadMonthData, loadAllTransactions]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    const onFocus = () => loadProfile(user.id);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pb-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const monthRange = getMonthRange(selectedMonth, monthEndDay);
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDate = new Date(monthRange.start.getFullYear(), monthRange.start.getMonth(), monthRange.start.getDate()).getTime();
  const endDate = new Date(monthRange.end.getFullYear(), monthRange.end.getMonth(), monthRange.end.getDate()).getTime();
  const isViewingCurrentMonth = nowDate >= startDate && nowDate <= endDate;
  const remainingDays = getRemainingDaysInPeriod(now, monthRange);
  const currentBalance = getCurrentBalance(totalIncome, totalExpense);
  const dailySpendingData = getDailySpendingForPeriod(
    allTransactions.map((t) => ({ type: t.type, amount: Number(t.amount), date: t.date })),
    monthRange.start,
    monthRange.end,
  );

  const txLike = allTransactions.map((t) => ({
    type: t.type as "income" | "expense",
    amount: Number(t.amount),
    category: t.category ?? undefined,
    date: t.date,
  }));
  const variableDailyRate = computeVariableDailyRate(txLike, now);
  const plannedRemaining = computePlannedRemaining(txLike, now, monthRange.start, monthRange.end);
  const forecast = computeForecastEnd(currentBalance, variableDailyRate, plannedRemaining, remainingDays);
  const projectedBalance = forecast.forecastEnd;
  const daysLeft = variableDailyRate > 0 ? currentBalance / variableDailyRate : currentBalance >= 0 ? Infinity : 0;
  const financialStatus = getFinancialStatus(projectedBalance, daysLeft, remainingDays);
  const todayStr = format(now, "yyyy-MM-dd");
  const todayExpense = isViewingCurrentMonth ? getTodayExpense(transactions, todayStr) : 0;
  const topCategories = getTopExpenseCategories(transactions, 5);
  const recommendation = (() => {
    if (financialStatus === "Risk") return "คาดการณ์ปลายเดือนอาจติดลบ ลองลดรายจ่ายหรือหารายได้เสริม";
    if (financialStatus === "Warning") return "ยอดคงเหลืออาจไม่พอถึงปลายเดือน ลดรายจ่ายผันแปรวันละนิดก็ช่วยได้";
    const top = topCategories[0];
    if (top && totalIncome > 0) {
      if ((top.category === "บิล/ค่าใช้จ่าย" || top.category === "ที่พัก/ค่าเช่า") && (top.total / totalIncome) * 100 > 40) return "ค่าบิล/ค่าเช่ากินงบเกินครึ่ง ลองตั้งเป้าไม่เกิน 40% ของรายได้";
      if (top.category === "อาหาร" && top.percent > 35) return "ค่าใช้จ่ายอาหารสูงกว่าปกติ ลองลดลงวันละ 50 บาท";
    }
    if (financialStatus === "Healthy") return "สถานะดีนะ ใช้จ่ายตามแผนต่อได้";
    return "";
  })();

  const totalDebt = profile?.total_liabilities ?? 0;
  const monthlyDebtPayment = profile?.monthly_debt_payment ?? 0;
  const initialDebtEstimate = totalDebt > 0 ? totalDebt * 1.2 : 0;
  const currentSaved = profile?.liquid_assets ?? 0;
  const targetSavings = currentSaved > 0 ? Math.max(currentSaved * 2, 100000) : 200000;

  const isHealthy = financialStatus === "Healthy";
  const isWarning = financialStatus === "Warning";

  return (
    <div className="animate-fade-in pb-20">
      {/* Header with logout */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">ภาพรวม</h1>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/auth/login");
            router.refresh();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          title="ออกจากระบบ"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span>ออกจากระบบ</span>
        </button>
      </div>

      <MonthSelector currentMonth={selectedMonth} onChange={setSelectedMonth} />

      {/* Hero Card */}
      <div className="px-4 mb-4">
        <div className={`rounded-xl p-5 text-white ${isHealthy ? "gradient-hero" : isWarning ? "gradient-warning" : "gradient-danger"}`}>
          <div className="flex items-center gap-2 mb-1">
            {isHealthy ? <CheckCircleIcon size={20} /> : isWarning ? <AlertTriangleIcon size={20} /> : <XCircleIcon size={20} />}
            <span className="text-sm font-medium opacity-90">
              {isHealthy ? "สถานะการเงินดี" : isWarning ? "ระวังค่าใช้จ่าย" : "มีโอกาสติดลบ"}
            </span>
          </div>
          <p className="text-3xl font-bold tabular-nums">฿{formatCurrency(currentBalance)}</p>
          <p className="text-sm opacity-80 mt-1">ยอดคงเหลือประจำเดือน</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="px-4 grid grid-cols-3 gap-3 mb-6">
        <MetricCard label="รายรับ" amount={totalIncome} icon={<TrendingUpIcon size={16} />} variant="success" />
        <MetricCard label="รายจ่าย" amount={totalExpense} icon={<WalletIcon size={16} />} variant="danger" />
        <MetricCard label="คงเหลือ" amount={currentBalance} icon={<CreditCardIcon size={16} />} variant="primary" />
      </div>

      {/* Savings Goals — always show links to goal pages */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">เป้าหมายการเงิน</h3>
        </div>
        <div className="space-y-3">
          <Link href="/savings-goal" className="block hover:opacity-95 transition-opacity">
            <GoalCard goal={{ target: targetSavings, current: currentSaved, label: "เป้าออมเงิน" }} />
          </Link>
          <Link href="/debt-goal" className="block hover:opacity-95 transition-opacity">
            <GoalCard goal={{ target: initialDebtEstimate, current: totalDebt > 0 ? initialDebtEstimate - totalDebt : 0, label: "เป้าปลดหนี้" }} />
          </Link>
        </div>
      </div>

      {/* AI Insights */}
      <div className="px-4 mb-6">
        <Link href="/ai-analysis">
          <Card className="shadow-card border-0 bg-secondary">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <SparklesIcon size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">AI แนะนำ</p>
                <p className="text-xs text-muted-foreground truncate">
                  {recommendation || "ให้ AI วิเคราะห์จากรายรับรายจ่ายของคุณ"}
                </p>
              </div>
              <ChevronRightIcon size={16} className="text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Spending Chart */}
      <div className="px-4 mb-6">
        <h3 className="font-semibold text-foreground mb-3">ค่าใช้จ่ายรายวัน</h3>
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={dailySpendingData}>
                <defs>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(173 78% 26%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(173 78% 26%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(value: number) => [`฿${formatCurrency(Number(value))}`, "ค่าใช้จ่าย"]}
                  contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                />
                <Area type="monotone" dataKey="expense" stroke="hsl(173 78% 26%)" fill="url(#expenseGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Expenses */}
      {topCategories.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">ค่าใช้จ่ายสูงสุด</h3>
          </div>
          <Card className="shadow-card border-0">
            <CardContent className="p-0">
              {topCategories.map((item, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i !== topCategories.length - 1 ? "border-b border-border" : ""}`}>
                  <CategoryIcon category={item.category} />
                  <span className="flex-1 text-sm font-medium text-foreground">{item.category}</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">฿{formatCurrency(item.total)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">รายการล่าสุด</h3>
          <Link href="/transactions" className="text-sm text-primary font-medium">ดูทั้งหมด</Link>
        </div>
        <Card className="shadow-card border-0">
          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                ยังไม่มีรายการในเดือนนี้
              </div>
            ) : (
              transactions.slice(0, 5).map((tx, i) => (
                <div key={tx.id} className={`flex items-center gap-3 px-4 py-3 ${i !== Math.min(transactions.length, 5) - 1 ? "border-b border-border" : ""}`}>
                  <CategoryIcon category={tx.category || ""} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tx.category || "-"}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${tx.type === "income" ? "text-success" : "text-foreground"}`}>
                    {tx.type === "income" ? "+" : "-"}฿{formatCurrency(Number(tx.amount))}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNavigation />
    </div>
  );
}

function MetricCard({ label, amount, icon, variant }: {
  label: string;
  amount: number;
  icon: React.ReactNode;
  variant: "success" | "danger" | "primary";
}) {
  const colorMap = {
    success: "text-success bg-success/10",
    danger: "text-danger bg-danger/10",
    primary: "text-primary bg-primary/10",
  };
  return (
    <Card className="shadow-card border-0">
      <CardContent className="p-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${colorMap[variant]}`}>
          {icon}
        </div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-base font-bold tabular-nums text-foreground">฿{formatCurrency(amount)}</p>
      </CardContent>
    </Card>
  );
}

function GoalCard({ goal }: { goal: { target: number; current: number; label: string } }) {
  const percent = Math.round((goal.current / goal.target) * 100);
  return (
    <Card className="shadow-card border-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">{goal.label}</span>
          <span className="text-xs text-muted-foreground">{percent}%</span>
        </div>
        <Progress value={percent} className="h-2 mb-1" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>฿{formatCurrency(goal.current)}</span>
          <span>฿{formatCurrency(goal.target)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
