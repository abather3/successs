import { EstimatedTime } from '../types';

/**
 * Formats an EstimatedTime object into a user-friendly string
 * @param estimatedTime - The EstimatedTime object to format
 * @returns A formatted string like "1 day 3 hr 20 min" or "45 min"
 */
export function formatEstimatedTime(estimatedTime: EstimatedTime): string {
  if (!estimatedTime) {
    return 'N/A';
  }

  const { days, hours, minutes } = estimatedTime;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }

  if (hours > 0) {
    parts.push(`${hours} hr${hours === 1 ? '' : 's'}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }

  // If no time components are provided, return "0 min"
  if (parts.length === 0) {
    return '0 min';
  }

  return parts.join(' ');
}

/**
 * Converts EstimatedTime object to total minutes for calculations
 * @param estimatedTime - The EstimatedTime object to convert
 * @returns Total minutes as a number
 */
export function estimatedTimeToMinutes(estimatedTime: EstimatedTime): number {
  if (!estimatedTime) {
    return 0;
  }

  const { days, hours, minutes } = estimatedTime;
  return (days * 24 * 60) + (hours * 60) + minutes;
}

/**
 * Converts total minutes back to EstimatedTime object
 * @param totalMinutes - Total minutes as a number
 * @returns EstimatedTime object
 */
export function minutesToEstimatedTime(totalMinutes: number): EstimatedTime {
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return { days, hours, minutes };
}
