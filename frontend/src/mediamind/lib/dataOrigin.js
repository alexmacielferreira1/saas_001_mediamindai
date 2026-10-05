export const DATA_SOURCE = Object.freeze({
  REAL: 'REAL',
  EMPTY: 'VAZIO',
  UNAVAILABLE: 'INDISPONIVEL',
  FORBIDDEN: 'SEM_PERMISSAO',
  DEMO: 'DEMONSTRACAO',
});

function errorDetails(error) {
  if (!error) return null;
  const details = { message: error.message || 'Não foi possível obter os dados.' };
  if (error.status !== undefined) details.status = error.status;
  if (error.code) details.code = error.code;
  return details;
}

function envelope(data, source, generatedAt = null, error = null, demoDataset = null) {
  return Object.freeze({
    data,
    source,
    generated_at: generatedAt,
    error: errorDetails(error),
    demo_dataset: demoDataset,
  });
}

export function realData(data, generatedAt = null) {
  return envelope(data, DATA_SOURCE.REAL, generatedAt);
}

export function emptyData(data = [], generatedAt = null) {
  return envelope(data, DATA_SOURCE.EMPTY, generatedAt);
}

export function unavailableData(error) {
  return envelope(null, DATA_SOURCE.UNAVAILABLE, null, error);
}

export function forbiddenData(error) {
  return envelope(null, DATA_SOURCE.FORBIDDEN, null, error);
}

export function demoData(data, dataset = 'demo_seed_v1') {
  return envelope(data, DATA_SOURCE.DEMO, null, null, dataset);
}

export function classifyRequestError(error) {
  return error?.status === 401 || error?.status === 403
    ? forbiddenData(error)
    : unavailableData(error);
}
