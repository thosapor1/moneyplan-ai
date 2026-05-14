#!/usr/bin/env node
// List distinct expense categories present in DB.
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/list-db-categories.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://lcibdxdpvzzprhsukwkb.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Distinct categories in transactions (expense type)
const txCounts = new Map();
let from = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await supa
    .from('transactions')
    .select('category, type')
    .eq('type', 'expense')
    .range(from, from + PAGE - 1);
  if (error) {
    console.error('transactions select error:', error);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  for (const row of data) {
    const cat = (row.category ?? '').trim();
    if (!cat) continue;
    txCounts.set(cat, (txCounts.get(cat) ?? 0) + 1);
  }
  if (data.length < PAGE) break;
  from += PAGE;
}

// 2. Distinct categories in category_budgets
const budgetCounts = new Map();
{
  const { data, error } = await supa
    .from('category_budgets')
    .select('category, budget');
  if (error) {
    console.error('category_budgets select error:', error);
    process.exit(1);
  }
  for (const row of data || []) {
    const cat = (row.category ?? '').trim();
    if (!cat) continue;
    budgetCounts.set(cat, (budgetCounts.get(cat) ?? 0) + 1);
  }
}

console.log('\n=== Categories in transactions (expense) ===');
[...txCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => {
    console.log(`  ${count.toString().padStart(5)}  ${cat}`);
  });

console.log('\n=== Categories in category_budgets ===');
[...budgetCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => {
    console.log(`  ${count.toString().padStart(5)}  ${cat}`);
  });

const KNOWN = new Set([
  'ค่าอาหาร',
  'ค่าเดินทาง',
  'ช้อปปิ้ง',
  'บิล/ค่าใช้จ่าย',
  'ค่าสุขภาพ',
  'ค่าบันเทิง',
  'ค่าการศึกษา',
  'ผ่อนชำระหนี้',
  'ออมเงิน',
  'ลงทุน',
  'อื่นๆ',
  // legacy aliases — already mapped
  'อาหาร',
  'เดินทาง',
  'สุขภาพ',
  'บันเทิง',
  'การศึกษา',
  'ที่พัก/ค่าเช่า',
  'สาธารณูปโภค',
  'โทรศัพท์/อินเทอร์เน็ต',
]);

const novel = new Set();
for (const cat of txCounts.keys()) if (!KNOWN.has(cat)) novel.add(cat);
for (const cat of budgetCounts.keys()) if (!KNOWN.has(cat)) novel.add(cat);

console.log('\n=== Novel (not in EXPENSE_CATEGORIES or alias map) ===');
if (novel.size === 0) {
  console.log('  (none)');
} else {
  [...novel].sort().forEach((cat) => {
    const tx = txCounts.get(cat) ?? 0;
    const bg = budgetCounts.get(cat) ?? 0;
    console.log(`  ${cat}  (tx=${tx}, budget_rows=${bg})`);
  });
}
