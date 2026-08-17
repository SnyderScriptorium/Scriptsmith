export function createWorldEntry(type = 'location', name = 'New Entry') {
  return { id: crypto.randomUUID(), type, name, description: '', details: {}, notes: '' };
}
