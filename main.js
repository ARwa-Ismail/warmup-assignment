const fs = require("fs");

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    function toSeconds(timeStr) {
        const [time, period] = timeStr.split(' ');
        let [h, m, s] = time.split(':').map(Number);
        if (period.toLowerCase() === 'pm' && h !== 12) h += 12;
        else if (period.toLowerCase() === 'am' && h === 12) h = 0;
        return h * 3600 + m * 60 + s;
    }
    const start = toSeconds(startTime);
    const end = toSeconds(endTime);
    let diff = end - start;
    if (diff < 0) diff += 24 * 3600;
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    function toSeconds(timeStr) {
        const [time, period] = timeStr.split(' ');
        let [h, m, s] = time.split(':').map(Number);
        if (period.toLowerCase() === 'pm' && h !== 12) h += 12;
        else if (period.toLowerCase() === 'am' && h === 12) h = 0;
        return h * 3600 + m * 60 + s;
    }

    const start = toSeconds(startTime);
    const end = toSeconds(endTime);
    const day = 24 * 3600;
    const morningIdleEnd = 8 * 3600;      // 8:00:00 am
    const eveningIdleStart = 22 * 3600;   // 10:00:00 pm

    function overlap(a, b, c, d) {
        const startOverlap = Math.max(a, c);
        const endOverlap = Math.min(b, d);
        return endOverlap > startOverlap ? endOverlap - startOverlap : 0;
    }

    let idleSeconds;
    if (end >= start) {
        idleSeconds = overlap(start, end, 0, morningIdleEnd) +
                      overlap(start, end, eveningIdleStart, day);
    } else {
        idleSeconds = overlap(start, day, 0, morningIdleEnd) +
                      overlap(start, day, eveningIdleStart, day) +
                      overlap(0, end, 0, morningIdleEnd) +
                      overlap(0, end, eveningIdleStart, day);
    }

    const hours = Math.floor(idleSeconds / 3600);
    const minutes = Math.floor((idleSeconds % 3600) / 60);
    const seconds = idleSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    function toSeconds(timeStr) {
        const parts = timeStr.split(':').map(Number);
        return parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }

    const shiftSec = toSeconds(shiftDuration);
    const idleSec = toSeconds(idleTime);
    const activeSec = Math.max(0, shiftSec - idleSec);

    const hours = Math.floor(activeSec / 3600);
    const minutes = Math.floor((activeSec % 3600) / 60);
    const seconds = activeSec % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    const [year, month, day] = date.split('-').map(Number);
    const isEid = (year === 2025 && month === 4 && day >= 10 && day <= 30);
    const quotaSeconds = isEid ? 6 * 3600 : 8 * 3600 + 24 * 60;

    const [hours, minutes, seconds] = activeTime.split(':').map(Number);
    const activeSeconds = hours * 3600 + minutes * 60 + seconds;
    return activeSeconds >= quotaSeconds;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    const content = fs.readFileSync(textFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    let duplicate = false;
    let lastIndexForDriver = -1;

    for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim());
        if (parts[0] === shiftObj.driverID) {
            lastIndexForDriver = i;
            if (parts[2] === shiftObj.date) {
                duplicate = true;
                break;
            }
        }
    }

    if (duplicate) return {};

    const shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    const idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    const activeTime = getActiveTime(shiftDuration, idleTime);
    const metQuotaFlag = metQuota(shiftObj.date, activeTime);

    const newRecord = [
        shiftObj.driverID,
        shiftObj.driverName,
        shiftObj.date,
        shiftObj.startTime,
        shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        metQuotaFlag ? 'true' : 'false',
        'false'
    ];

    const newLine = newRecord.join(',');
    let newLines = [...lines];
    if (lastIndexForDriver === -1) {
        newLines.push(newLine);
    } else {
        newLines.splice(lastIndexForDriver + 1, 0, newLine);
    }

    fs.writeFileSync(textFile, newLines.join('\n'), 'utf8');

    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: metQuotaFlag,
        hasBonus: false
    };
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    const content = fs.readFileSync(textFile, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;
        const parts = line.split(',').map(s => s.trim());
        if (parts.length < 10) continue;
        if (parts[0] === driverID && parts[2] === date) {
            parts[9] = newValue ? 'true' : 'false';
            lines[i] = parts.join(',');
            break;
        }
    }
    fs.writeFileSync(textFile, lines.join('\n'), 'utf8');
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    const content = fs.readFileSync(textFile, 'utf8');
    const lines = content.split('\n');
    let count = 0;
    let driverFound = false;
    const targetMonth = parseInt(month, 10);

    for (let line of lines) {
        line = line.trim();
        if (line === '') continue;
        const parts = line.split(',').map(s => s.trim());
        if (parts.length < 10) continue;
        if (parts[0] === driverID) {
            driverFound = true;
            const dateStr = parts[2];
            const monthPart = parseInt(dateStr.split('-')[1], 10);
            if (monthPart === targetMonth && parts[9] === 'true') {
                count++;
            }
        }
    }
    return driverFound ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    function toSeconds(timeStr) {
        const parts = timeStr.split(':').map(Number);
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }

    const content = fs.readFileSync(textFile, 'utf8');
    const lines = content.split('\n');
    const targetMonth = parseInt(month, 10);
    let totalSeconds = 0;

    for (let line of lines) {
        line = line.trim();
        if (line === '') continue;
        const parts = line.split(',').map(s => s.trim());
        if (parts.length < 8) continue;
        if (parts[0] !== driverID) continue;
        const dateStr = parts[2];
        const monthPart = parseInt(dateStr.split('-')[1], 10);
        if (monthPart !== targetMonth) continue;
        totalSeconds += toSeconds(parts[7]);
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    // Get driver's day off from rateFile
    function getDayOff(id) {
        const content = fs.readFileSync(rateFile, 'utf8');
        const lines = content.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (line === '') continue;
            const parts = line.split(',').map(s => s.trim());
            if (parts[0] === id) return parts[1];
        }
        return null;
    }

    const dayOffStr = getDayOff(driverID);
    if (!dayOffStr) return "0:00:00";

    const dayMap = {
        "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
        "Thursday": 4, "Friday": 5, "Saturday": 6
    };
    const dayOffNum = dayMap[dayOffStr];

    // Read shifts to find all dates this driver worked in the given month
    const content = fs.readFileSync(textFile, 'utf8');
    const lines = content.split('\n');
    const targetMonth = parseInt(month, 10);
    const year = 2025;

    // Use a Set to collect unique dates (to avoid double counting if multiple shifts same day)
    const workedDates = new Set();

    for (let line of lines) {
        line = line.trim();
        if (line === '') continue;
        const parts = line.split(',').map(s => s.trim());
        if (parts.length < 8) continue;
        if (parts[0] !== driverID) continue;

        const dateStr = parts[2];
        const [y, m, d] = dateStr.split('-').map(Number);
        if (y === year && m === targetMonth) {
            workedDates.add(dateStr);
        }
    }

    const NORMAL_QUOTA = 8 * 3600 + 24 * 60; // 8:24:00
    const EID_QUOTA = 6 * 3600;              // 6:00:00
    let totalSec = 0;

    for (let dateStr of workedDates) {
        const [y, m, d] = dateStr.split('-').map(Number);

        // Skip if this date is the driver's day off
        const date = new Date(Date.UTC(y, m - 1, d));
        if (date.getUTCDay() === dayOffNum) continue;

        const isEid = (y === 2025 && m === 4 && d >= 10 && d <= 30);
        totalSec += isEid ? EID_QUOTA : NORMAL_QUOTA;
    }

    // Subtract bonus hours (2 hours per bonus)
    totalSec -= bonusCount * 2 * 3600;
    if (totalSec < 0) totalSec = 0;

    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    function toSeconds(timeStr) {
        const parts = timeStr.split(':').map(Number);
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }

    function getDriverRateInfo(id) {
        const content = fs.readFileSync(rateFile, 'utf8');
        const lines = content.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (line === '') continue;
            
            const parts = line.split(',').map(s => s.trim());
            if (parts.length < 4) continue;

            if (parts[0] === id) {
                return {
                    basePay: parseInt(parts[2], 10),
                    tier: parseInt(parts[3], 10)
                };
            }
        }
        return null;
    }

    const rateInfo = getDriverRateInfo(driverID);

    if (!rateInfo) return 0;

    const { basePay, tier } = rateInfo;

    const allowedMissing = { 1: 50, 2: 20, 3: 10, 4: 3 };
    const allowed = allowedMissing[tier] || 0;

    const actualSec = toSeconds(actualHours);

    const requiredSec = toSeconds(requiredHours);

    const missingSec = Math.max(0, requiredSec - actualSec);
    const missingHoursFloat = missingSec / 3600;

    const remainingFloat = Math.max(0, missingHoursFloat - allowed);
    const billableHours = Math.floor(remainingFloat);


    const dedRatePerHour = Math.floor(basePay / 185);
    const salaryDed = billableHours * dedRatePerHour;
    return basePay - salaryDed;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay};
