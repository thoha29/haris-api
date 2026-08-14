/**
 * Modular Overtime Calculator
 * 
 * Rules:
 * - Lembur di Hari Libur / OFF:
 *   - Jam 1 s/d Jam 8: 2.0x
 *   - Jam ke-8 s/d Jam ke-9 (Jam ke-9): 3.0x
 *   - Jam ke-9 dan seterusnya (> 9 jam): 4.0x
 * 
 * - Lembur di Hari Biasa:
 *   - Jam 1 s/d Jam 6: 1.5x
 *   - Jam ke-6 dan seterusnya (> 6 jam): 2.0x
 */

const OVERTIME_RATES = {
  HOLIDAY: {
    TIER_1_LIMIT: 8,
    TIER_1_MULTIPLIER: 2.0,
    TIER_2_LIMIT: 9,
    TIER_2_MULTIPLIER: 3.0,
    TIER_3_MULTIPLIER: 4.0,
  },
  REGULAR: {
    TIER_1_LIMIT: 6,
    TIER_1_MULTIPLIER: 1.5,
    TIER_2_MULTIPLIER: 2.0,
  },
};

/**
 * Menghitung lembur konversi berdasarkan jam lembur aktual dan jenis hari.
 * @param {number} actualHours - Jam lembur aktual
 * @param {boolean} isHoliday - Apakah lembur dilakukan di hari libur/OFF
 * @returns {number} Jam lembur konversi (dibulatkan 2 desimal)
 */
function calculateLemburKonversi(actualHours, isHoliday = false) {
  const hours = parseFloat(actualHours) || 0;
  if (hours <= 0) return 0;

  let konversi = 0;

  if (isHoliday) {
    const { TIER_1_LIMIT, TIER_1_MULTIPLIER, TIER_2_LIMIT, TIER_2_MULTIPLIER, TIER_3_MULTIPLIER } = OVERTIME_RATES.HOLIDAY;
    
    if (hours <= TIER_1_LIMIT) {
      konversi = hours * TIER_1_MULTIPLIER;
    } else if (hours <= TIER_2_LIMIT) {
      const tier1 = TIER_1_LIMIT * TIER_1_MULTIPLIER;
      const tier2 = (hours - TIER_1_LIMIT) * TIER_2_MULTIPLIER;
      konversi = tier1 + tier2;
    } else {
      const tier1 = TIER_1_LIMIT * TIER_1_MULTIPLIER;
      const tier2 = (TIER_2_LIMIT - TIER_1_LIMIT) * TIER_2_MULTIPLIER;
      const tier3 = (hours - TIER_2_LIMIT) * TIER_3_MULTIPLIER;
      konversi = tier1 + tier2 + tier3;
    }
  } else {
    const { TIER_1_LIMIT, TIER_1_MULTIPLIER, TIER_2_MULTIPLIER } = OVERTIME_RATES.REGULAR;
    
    if (hours <= TIER_1_LIMIT) {
      konversi = hours * TIER_1_MULTIPLIER;
    } else {
      const tier1 = TIER_1_LIMIT * TIER_1_MULTIPLIER;
      const tier2 = (hours - TIER_1_LIMIT) * TIER_2_MULTIPLIER;
      konversi = tier1 + tier2;
    }
  }

  return Number(konversi.toFixed(2));
}

module.exports = {
  OVERTIME_RATES,
  calculateLemburKonversi,
};
