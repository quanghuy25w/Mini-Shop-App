import { describe, it, expect } from 'vitest';
import { getBusinessDate, getVnMinutes, getVnParts } from '../utils/businessDate';
import { determineShiftForTime, isOutOfShift } from '../utils/shiftConfig';

describe('businessDate and shiftConfig Utilities', () => {
  describe('businessDate utility functions', () => {
    it('Correctly formats business date in Vietnam timezone (Asia/Ho_Chi_Minh)', () => {
      // 2026-09-12 17:30 UTC is 2026-09-13 00:30 in VN
      const lateUtc = new Date('2026-09-12T17:30:00.000Z');
      expect(getBusinessDate(lateUtc)).toBe('2026-09-13');

      // 2026-09-12 01:00 UTC is 2026-09-12 08:00 in VN
      const mornUtc = new Date('2026-09-12T01:00:00.000Z');
      expect(getBusinessDate(mornUtc)).toBe('2026-09-12');
    });

    it('Correctly calculates VN minutes from midnight', () => {
      // 01:00 UTC = 08:00 VN = 480 minutes
      const time1 = new Date('2026-09-12T01:00:00.000Z');
      expect(getVnMinutes(time1)).toBe(480);

      // 05:30 UTC = 12:30 VN = 750 minutes
      const time2 = new Date('2026-09-12T05:30:00.000Z');
      expect(getVnMinutes(time2)).toBe(750);
    });

    it('Provides correct VN parts', () => {
      const d = new Date('2026-09-12T01:05:09.000Z');
      const parts = getVnParts(d);
      expect(parts.year).toBe('2026');
      expect(parts.month).toBe('09');
      expect(parts.day).toBe('12');
      expect(parts.hour).toBe('08');
      expect(parts.minute).toBe('05');
      expect(parts.second).toBe('09');
    });
  });

  describe('shiftConfig determineShiftForTime & isOutOfShift rules', () => {
    it('Returns null outside business window 07:00 - 22:30', () => {
      // 06:30 VN (23:30 UTC previous day)
      const early = new Date('2026-09-11T23:30:00.000Z');
      expect(determineShiftForTime(early)).toBeNull();

      // 22:45 VN (15:45 UTC)
      const late = new Date('2026-09-12T15:45:00.000Z');
      expect(determineShiftForTime(late)).toBeNull();
    });

    it('Identifies rest periods (12:00 - 13:00 and 18:30 - 19:00)', () => {
      // 12:15 VN (05:15 UTC)
      const lunch = new Date('2026-09-12T05:15:00.000Z');
      const resLunch = determineShiftForTime(lunch);
      expect(resLunch.isRestPeriod).toBe(true);
      expect(resLunch.restLabel).toBe('Nghỉ trưa');
      expect(resLunch.shiftType).toBeNull();

      // 18:40 VN (11:40 UTC)
      const dinner = new Date('2026-09-12T11:40:00.000Z');
      const resDinner = determineShiftForTime(dinner);
      expect(resDinner.isRestPeriod).toBe(true);
      expect(resDinner.restLabel).toBe('Nghỉ tối');
      expect(resDinner.shiftType).toBeNull();
    });

    it('Calculates morning shift grace and late status', () => {
      // 07:00 VN: early morning
      const earlyMorn = new Date('2026-09-12T00:00:00.000Z');
      const resEarly = determineShiftForTime(earlyMorn);
      expect(resEarly.shiftType).toBe('morning');
      expect(resEarly.isLate).toBe(false);
      expect(resEarly.isEarly).toBe(true);

      // 07:35 VN: within grace (5 mins)
      const graceMorn = new Date('2026-09-12T00:35:00.000Z');
      const resGrace = determineShiftForTime(graceMorn);
      expect(resGrace.shiftType).toBe('morning');
      expect(resGrace.isLate).toBe(false);

      // 07:36 VN: late by 1 minute (past grace period)
      const lateMorn = new Date('2026-09-12T00:36:00.000Z');
      const resLate = determineShiftForTime(lateMorn);
      expect(resLate.shiftType).toBe('morning');
      expect(resLate.isLate).toBe(true);
      expect(resLate.lateMinutes).toBe(1);
    });

    it('Calculates afternoon shift grace and late status', () => {
      // 13:00 VN: on time
      const onTimeAft = new Date('2026-09-12T06:00:00.000Z');
      const resOnTime = determineShiftForTime(onTimeAft);
      expect(resOnTime.shiftType).toBe('afternoon');
      expect(resOnTime.isLate).toBe(false);

      // 13:05 VN: within grace
      const graceAft = new Date('2026-09-12T06:05:00.000Z');
      expect(determineShiftForTime(graceAft).isLate).toBe(false);

      // 13:10 VN: late by 5 minutes (past grace period)
      const lateAft = new Date('2026-09-12T06:10:00.000Z');
      const resLate = determineShiftForTime(lateAft);
      expect(resLate.shiftType).toBe('afternoon');
      expect(resLate.isLate).toBe(true);
      expect(resLate.lateMinutes).toBe(5);
    });

    it('Calculates evening shift grace and late status', () => {
      // 19:00 VN: on time
      const onTimeEve = new Date('2026-09-12T12:00:00.000Z');
      const resOnTime = determineShiftForTime(onTimeEve);
      expect(resOnTime.shiftType).toBe('evening');
      expect(resOnTime.isLate).toBe(false);

      // 19:20 VN: late by 15 minutes (past grace period)
      const lateEve = new Date('2026-09-12T12:20:00.000Z');
      const resLate = determineShiftForTime(lateEve);
      expect(resLate.shiftType).toBe('evening');
      expect(resLate.isLate).toBe(true);
      expect(resLate.lateMinutes).toBe(15);
    });

    it('Determines isOutOfShift correctly', () => {
      const activeSession = { status: 'active' };
      // 12:15 VN (during rest): not out of shift
      const restTime = new Date('2026-09-12T05:15:00.000Z');
      expect(isOutOfShift(activeSession, restTime)).toBe(false);

      // 22:45 VN (after 22:00): out of shift
      const lateTime = new Date('2026-09-12T15:45:00.000Z');
      expect(isOutOfShift(activeSession, lateTime)).toBe(true);

      // 06:30 VN (before 07:30): out of shift
      const earlyTime = new Date('2026-09-11T23:30:00.000Z');
      expect(isOutOfShift(activeSession, earlyTime)).toBe(true);
    });
  });
});
