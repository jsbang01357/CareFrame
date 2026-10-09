export const personaIds = ['younghee', 'cheolsu'] as const;
export type PersonaId = (typeof personaIds)[number];

export const personaNames: Record<PersonaId, string> = {
  younghee: '영희',
  cheolsu: '철수',
};
