export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  // Uses Int.DateTimeFormat to ensure consistent SP formatting
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
};

export const formatBirthDate = (dateString) => {
  if (!dateString) return '';
  // Handles YYYY-MM-DD from inputs
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Returns a Date object where the local time values match the time in São Paulo.
 * This effectively "shifts" the date so that getHours(), getDate(), etc. return SP values.
 * Useful for date math relative to SP timezone.
 */
export const getSaoPauloDate = (date = new Date()) => {
  return new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
};