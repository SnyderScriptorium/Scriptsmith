export function createCharacter(name = 'New Character') {
  return { id: crypto.randomUUID(), name, age: '', appearance: '', personality: '', background: '', goals: '', fears: '', relationships: [], arc: '', notes: '' };
}
