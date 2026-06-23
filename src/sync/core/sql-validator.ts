/**
 * Validateur SQL pour détecter les erreurs de paramètres
 * Empêche "RangeError: Too many parameter values were provided"
 */
export function validateSqlParams(query: string, params: any[]): void {
  const placeholderCount = (query.match(/\?/g) || []).length;
  const paramCount = params.length;
  
  if (placeholderCount !== paramCount) {
    const error = new Error(`SQL parameter mismatch: query has ${placeholderCount} placeholders (?) but ${paramCount} params provided`);
    console.error('[SQL VALIDATION ERROR]', {
      query: query.substring(0, 200),
      placeholderCount,
      paramCount,
      params: params.map((p, i) => `[${i}]=${typeof p}:${JSON.stringify(p)}`).join(', ')
    });
    throw error;
  }
}

export function logSqlDebug(label: string, query: string, params: any[]): void {
  console.log(`[SQL DEBUG] ${label}`, {
    query: query.substring(0, 300),
    paramCount: params.length,
    params: params.map((p, i) => `[${i}]=${typeof p}:${JSON.stringify(p)}`).join(', ')
  });
}