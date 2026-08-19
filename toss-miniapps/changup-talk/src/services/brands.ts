import { getIndustryProfile, getAllIndustryOptions } from '../data/industries';
import type { BrandCategory, BrandComparisonRow, BrandRecord, CostBand, IndustryProfile } from '../types/startup';
import { resolveFranchiseSnapshot } from './franchise';

export function inferBrandCategory(profile: IndustryProfile): BrandCategory {
  if (profile.name.includes('카페')) return '카페';
  if (profile.name.includes('치킨')) return '치킨';
  if (profile.name.includes('한식')) return '한식';
  if (profile.name.includes('분식')) return '분식';
  if (profile.name.includes('피자')) return '피자';
  if (profile.name.includes('베이커')) return '베이커리';
  if (profile.tags.some((tag) => tag.includes('배달전문')) || profile.group === '배달 전문점') return '배달';
  if (profile.tags.some((tag) => tag.includes('무인')) || profile.group === '무인 창업') return '무인';
  if (profile.name.includes('교육')) return '교육';
  if (profile.tags.some((tag) => tag.includes('서비스'))) return '서비스';
  return '기타';
}

function buildBand(base: number | null, reliability: number): CostBand | null {
  if (typeof base !== 'number' || !Number.isFinite(base)) return null;
  const spread = reliability >= 90 ? 0.08 : reliability >= 80 ? 0.12 : 0.16;
  return {
    min: Math.round(base * (1 - spread) / 10000) * 10000,
    base: Math.round(base / 10000) * 10000,
    max: Math.round(base * (1 + spread) / 10000) * 10000
  };
}

export async function resolveBrandRecord(profile: IndustryProfile): Promise<BrandRecord> {
  const snapshot = await resolveFranchiseSnapshot(profile);
  const totalBase = snapshot.totalStartupCost || snapshot.fee + snapshot.educationFee + snapshot.deposit + snapshot.otherCost;
  return {
    brandId: profile.id,
    brandName: snapshot.brandName,
    category: inferBrandCategory(profile),
    industryId: profile.id,
    industryName: profile.name,
    franchiseHead: snapshot.brandName,
    sourceMeta: snapshot.sourceMeta,
    isRealData: snapshot.source === 'real',
    isPartner: snapshot.isPartner,
    partnershipType: snapshot.partnershipType,
    franchiseFee: snapshot.fee,
    educationFee: snapshot.educationFee,
    deposit: snapshot.deposit,
    otherCost: snapshot.otherCost,
    totalStartupCost: buildBand(totalBase, snapshot.sourceMeta.reliability),
    note: snapshot.notice
  };
}

export async function resolveBrandComparison(profiles: IndustryProfile[], availableCapital: number): Promise<BrandComparisonRow[]> {
  const records = await Promise.all(profiles.map(async (profile) => resolveBrandRecord(profile)));
  return records.map((record) => ({
    brandId: record.brandId,
    brandName: record.brandName,
    category: record.category,
    sourceMeta: record.sourceMeta,
    isRealData: record.isRealData,
    isPartner: record.isPartner,
    partnershipType: record.partnershipType,
    fee: record.franchiseFee,
    educationFee: record.educationFee,
    deposit: record.deposit,
    otherCost: record.otherCost,
    totalStartupCost: record.totalStartupCost?.base ?? null,
    capitalGap: availableCapital - (record.totalStartupCost?.base ?? 0)
  }));
}

export function getBrandProfiles() {
  return getAllIndustryOptions().map((profile) => ({
    profile,
    category: inferBrandCategory(profile)
  }));
}

export function getBrandProfileById(id: string) {
  return getIndustryProfile(id);
}
