// ---------------------------------------------------------------------------
// Todos os services do EdKut retornam Promises, mesmo lendo de mocks locais.
// Isso mantém a mesma assinatura de função que será usada quando os mocks
// forem substituídos por chamadas reais de API (ver README.md).
// ---------------------------------------------------------------------------
export function simulateDelay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
