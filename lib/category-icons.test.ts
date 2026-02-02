/**
 * Unit tests for category icon mapping.
 * Run: npm test
 */

import { describe, it, expect } from 'vitest'
import {
  getCategoryIconKey,
  getCategoryIconStyle,
  CATEGORY_TO_ICON_KEY,
} from './category-icons'

describe('getCategoryIconKey', () => {
  it("'อาหาร' returns food icon key", () => {
    expect(getCategoryIconKey('อาหาร')).toBe('food')
  })

  it("'การศึกษา' returns education (book) icon key", () => {
    expect(getCategoryIconKey('การศึกษา')).toBe('education')
  })

  it('unknown category returns fallback icon key', () => {
    expect(getCategoryIconKey('unknown')).toBe('fallback')
    expect(getCategoryIconKey('')).toBe('fallback')
    expect(getCategoryIconKey('ไม่ระบุหมวด')).toBe('fallback')
  })

  it('maps all required expense categories to correct keys', () => {
    expect(getCategoryIconKey('ค่าเดินทาง')).toBe('transit')
    expect(getCategoryIconKey('ที่พัก/ค่าเช่า')).toBe('home')
    expect(getCategoryIconKey('สาธารณูปโภค')).toBe('utilities')
    expect(getCategoryIconKey('สุขภาพ')).toBe('health')
    expect(getCategoryIconKey('บันเทิง')).toBe('entertainment')
    expect(getCategoryIconKey('ช้อปปิ้ง')).toBe('shopping')
    expect(getCategoryIconKey('โทรศัพท์/อินเทอร์เน็ต')).toBe('phone')
    expect(getCategoryIconKey('ผ่อนชำระหนี้')).toBe('debt')
    expect(getCategoryIconKey('ลงทุน')).toBe('investment')
    expect(getCategoryIconKey('ออมเงิน')).toBe('savings')
    expect(getCategoryIconKey('อื่นๆ')).toBe('other')
  })

  it('maps income categories correctly', () => {
    expect(getCategoryIconKey('เงินเดือน')).toBe('income_briefcase')
    expect(getCategoryIconKey('รายได้เสริม')).toBe('income_trending')
  })
})

describe('getCategoryIconStyle', () => {
  it('returns bg and icon (fg) for known category', () => {
    const style = getCategoryIconStyle('อาหาร')
    expect(style).toHaveProperty('bg')
    expect(style).toHaveProperty('icon')
    expect(style.bg).toBe('bg-amber-100')
    expect(style.icon).toBe('text-amber-800')
  })

  it('returns fallback style for unknown category', () => {
    const style = getCategoryIconStyle('unknown')
    expect(style.bg).toBe('bg-gray-100')
    expect(style.icon).toBe('text-gray-700')
  })
})

describe('CATEGORY_TO_ICON_KEY', () => {
  it('is keyed by Thai category strings only (no index-based mapping)', () => {
    const keys = Object.keys(CATEGORY_TO_ICON_KEY)
    expect(keys).toContain('อาหาร')
    expect(keys).toContain('การศึกษา')
    expect(keys).toContain('อื่นๆ')
    expect(keys.every((k) => typeof k === 'string' && k.length > 0)).toBe(true)
  })
})
