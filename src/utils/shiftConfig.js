import { getVnMinutes, TIMEZONE_VN } from './businessDate';

export const TIMEZONE = TIMEZONE_VN;

export const DAILY_SESSION = { start: '07:30', end: '22:00' };

export const SHIFT_FRAMES = {
  morning:   { start: '07:30', end: '12:00', startH: 7,  startM: 30, endH: 12, endM: 0,  graceMinutes: 5, name: 'Ca sáng', codeSuffix: '01' },
  afternoon: { start: '13:00', end: '18:30', startH: 13, startM: 0,  endH: 18, endM: 30, graceMinutes: 5, name: 'Ca chiều', codeSuffix: '02' },
  evening:   { start: '19:00', end: '22:00', startH: 19, startM: 0,  endH: 22, endM: 0,  graceMinutes: 5, name: 'Ca tối', codeSuffix: '03' }
};

export const REST_PERIODS = [
  { start: '12:00', end: '13:00', startMins: 720, endMins: 780, label: 'Nghỉ trưa' },
  { start: '18:30', end: '19:00', startMins: 1110, endMins: 1140, label: 'Nghỉ tối' }
];

export const BUSINESS_WINDOW = { start: '07:00', end: '22:30', startMins: 420, endMins: 1350 };

/**
 * Xác định khung ca làm việc hoặc trạng thái nghỉ theo thời gian thực (giờ VN).
 * @param {Date|string|number} now
 * @returns {{ shiftType: string|null, shiftName?: string, shiftDef?: object, isLate: boolean, lateMinutes: number, isRestPeriod: boolean, restLabel?: string, isEarly?: boolean } | null}
 */
export const determineShiftForTime = (now = new Date()) => {
  const totalMins = getVnMinutes(now);

  // Ngoài giờ hoạt động (< 07:00 hoặc > 22:30)
  if (totalMins < 420 || totalMins > 1350) {
    return null;
  }

  // Giờ nghỉ trưa: 12:00 (720) -> 12:59 (779)
  if (totalMins >= 720 && totalMins < 780) {
    return { frame: null, shiftType: null, isRestPeriod: true, restLabel: 'Nghỉ trưa', isLate: false, lateMinutes: 0 };
  }

  // Giờ nghỉ tối: 18:30 (1110) -> 18:59 (1139)
  if (totalMins >= 1110 && totalMins < 1140) {
    return { frame: null, shiftType: null, isRestPeriod: true, restLabel: 'Nghỉ tối', isLate: false, lateMinutes: 0 };
  }

  // Khung ca sáng: 07:00 (420) -> 11:59 (719)
  if (totalMins >= 420 && totalMins < 720) {
    const shiftDef = SHIFT_FRAMES.morning;
    const isEarly = totalMins < 450;
    const graceEnd = 450 + shiftDef.graceMinutes;
    const isLate = totalMins > graceEnd; // Grace 5 phút: 07:30 - 07:35 đúng giờ, 07:36 trở đi muộn
    const lateMinutes = isLate ? totalMins - graceEnd : 0;
    return {
      shiftType: 'morning',
      shiftName: shiftDef.name,
      shiftDef,
      isLate,
      lateMinutes,
      isEarly,
      isRestPeriod: false
    };
  }

  // Khung ca chiều: 13:00 (780) -> 18:29 (1109)
  if (totalMins >= 780 && totalMins < 1110) {
    const shiftDef = SHIFT_FRAMES.afternoon;
    const graceEnd = 780 + shiftDef.graceMinutes;
    const isLate = totalMins > graceEnd; // Grace 5 phút: 13:00 - 13:05 đúng giờ, 13:06 trở đi muộn
    const lateMinutes = isLate ? totalMins - graceEnd : 0;
    return {
      shiftType: 'afternoon',
      shiftName: shiftDef.name,
      shiftDef,
      isLate,
      lateMinutes,
      isEarly: false,
      isRestPeriod: false
    };
  }

  // Khung ca tối: 19:00 (1140) -> 22:30 (1350)
  if (totalMins >= 1140 && totalMins <= 1350) {
    const shiftDef = SHIFT_FRAMES.evening;
    const graceEnd = 1140 + shiftDef.graceMinutes;
    const isLate = totalMins > graceEnd; // Grace 5 phút: 19:00 - 19:05 đúng giờ, 19:06 trở đi muộn
    const lateMinutes = isLate ? totalMins - graceEnd : 0;
    return {
      shiftType: 'evening',
      shiftName: shiftDef.name,
      shiftDef,
      isLate,
      lateMinutes,
      isEarly: false,
      isRestPeriod: false
    };
  }

  return null;
};

/**
 * Kiểm tra xem thời điểm `now` có nằm ngoài giờ mở cửa cửa hàng (07:30 - 22:00) hoặc ca đã đóng hay không.
 * Lưu ý: Trong giờ nghỉ (12:00-13:00, 18:30-19:00), cửa hàng vẫn trong ngày làm việc nên outOfShift = false.
 * @param {Object} session - WorkSession object
 * @param {Date|string|number} now - Thời điểm thực hiện giao dịch (mặc định: new Date())
 * @returns {boolean}
 */
export const isOutOfShift = (session, now = new Date()) => {
  if (session && (session.status === 'closed' || session.status === 'cancelled')) {
    return true;
  }
  const totalMins = getVnMinutes(now);
  // Cửa hàng mở cửa từ 07:30 (450) đến 22:00 (1320)
  return totalMins < 450 || totalMins > 1320;
};
