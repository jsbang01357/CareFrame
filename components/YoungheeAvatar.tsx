'use client';

import Image from 'next/image';
import youngheePortrait from '../pictures/younghee.png';
import youngheeBasic from '../pictures/younghee-expressions/younghee-basic.png';
import youngheeHappy from '../pictures/younghee-expressions/younghee-happy.png';
import youngheeWorried from '../pictures/younghee-expressions/younghee-worried.png';
import youngheeSad from '../pictures/younghee-expressions/younghee-sad.png';
import youngheeThinking from '../pictures/younghee-expressions/younghee-thinking.png';
import youngheeSurprised from '../pictures/younghee-expressions/younghee-surprised.png';
import youngheeReassured from '../pictures/younghee-expressions/younghee-reassured.png';
import youngheeSerious from '../pictures/younghee-expressions/younghee-serious.png';
import cheolsuPortrait from '../pictures/cheolsu.png';
import cheolsuHappy from '../pictures/cheolsu_expressions/cheolsu_happy.png';
import cheolsuNeutral from '../pictures/cheolsu_expressions/cheolsu_neutral.png';
import cheolsuRelieved from '../pictures/cheolsu_expressions/cheolsu_relieved.png';
import cheolsuSad from '../pictures/cheolsu_expressions/cheolsu_sad.png';
import cheolsuSerious from '../pictures/cheolsu_expressions/cheolsu_serious.png';
import cheolsuSurprised from '../pictures/cheolsu_expressions/cheolsu_surprised.png';
import cheolsuThinking from '../pictures/cheolsu_expressions/cheolsu_thinking.png';
import cheolsuWorried from '../pictures/cheolsu_expressions/cheolsu_worried.png';
import { questionField, riskFields, type FieldId } from '@/data/protocol';
import type { InterviewState, NextAction } from '@/lib/contracts';
import type { VoiceStatus } from '@/lib/voice/controller';
import type { PersonaId } from '@/lib/persona';

export type PersonaExpression = 'basic' | 'happy' | 'worried' | 'sad' | 'thinking' | 'surprised' | 'reassured' | 'serious';
export type PersonaAvatarVariant = 'intro' | 'session' | 'report';

const personaImages = {
  younghee: {
    portrait: youngheePortrait,
    expressions: {
      basic: youngheeBasic,
      happy: youngheeHappy,
      worried: youngheeWorried,
      sad: youngheeSad,
      thinking: youngheeThinking,
      surprised: youngheeSurprised,
      reassured: youngheeReassured,
      serious: youngheeSerious,
    },
  },
  cheolsu: {
    portrait: cheolsuPortrait,
    expressions: {
      basic: cheolsuNeutral,
      happy: cheolsuHappy,
      worried: cheolsuWorried,
      sad: cheolsuSad,
      thinking: cheolsuThinking,
      surprised: cheolsuSurprised,
      reassured: cheolsuRelieved,
      serious: cheolsuSerious,
    },
  },
} satisfies Record<PersonaId, { portrait: typeof youngheePortrait; expressions: Record<PersonaExpression, typeof youngheeBasic> }>;

const symptomFields = new Set<FieldId>([
  'chief_complaint', 'location', 'onset', 'pattern', 'severity_function',
  'character', 'meal_relation', 'vomiting', 'fever', 'cold_sweat',
]);

const difficultExperienceCue = /힘들|버겁|슬프|무섭|두렵|괴롭|속상|외롭|눈물|그리워|상실|떠나보내|돌아가셨|사별/u;
const unexpectedSymptomCue = /갑자기|갑작스럽|뜻밖|예상하지 못|생각도 못|놀랐|깜짝/u;

export function getPersonaAnswerMoment(text: string): PersonaExpression {
  if (difficultExperienceCue.test(text)) return 'sad';
  if (unexpectedSymptomCue.test(text)) return 'surprised';
  return 'reassured';
}

export function getPersonaExpression(
  state: InterviewState | null,
  next: NextAction,
  busy: boolean,
  voiceStatus: VoiceStatus,
  moment: PersonaExpression | null,
): PersonaExpression {
  if (!state) return 'basic';
  if (state.safety.latched || state.phase === 'urgent_stop' || state.phase === 'out_of_scope' || next.kind === 'urgent_help' || next.kind === 'out_of_scope') return 'serious';
  if (state.phase === 'finished' || next.kind === 'finish' || (state.phase === 'review' && state.completion === 'complete')) return 'happy';
  if (state.phase === 'interviewing' && state.turns.length === 0 && next.kind === 'ask') return 'basic';
  if (busy || voiceStatus === 'processing' || voiceStatus === 'speaking' || next.kind === 'clarify' || state.phase === 'error_paused') return 'thinking';

  const activeField = questionField(state.last_question_id);
  if (activeField && riskFields.includes(activeField)) return 'serious';
  if (state.phase === 'review') return 'thinking';
  if (moment) return moment;
  if (state.facts.some(fact => symptomFields.has(fact.field_id) && fact.status === 'reported')) return 'worried';
  return 'basic';
}

export function PersonaAvatar({
  personaId = 'younghee',
  expression = 'basic',
  variant,
}: {
  personaId?: PersonaId;
  expression?: PersonaExpression;
  variant: PersonaAvatarVariant;
}) {
  const persona = personaImages[personaId];
  const source = variant === 'intro' ? persona.portrait : persona.expressions[expression];
  const sizes = variant === 'intro' ? '76px' : variant === 'report' ? '54px' : '70px';

  return <span className={`persona-icon younghee-avatar younghee-avatar--${variant}`} data-expression={expression} data-persona={personaId} aria-hidden="true">
    <Image key={`${variant}-${expression}`} src={source} alt="" className="younghee-avatar__image" sizes={sizes} loading={variant === 'intro' ? 'eager' : 'lazy'} />
  </span>;
}

export type YoungheeExpression = PersonaExpression;
export type YoungheeAvatarVariant = PersonaAvatarVariant;
export const getYoungheeAnswerMoment = getPersonaAnswerMoment;
export const getYoungheeExpression = getPersonaExpression;
export function YoungheeAvatar(props: { expression?: PersonaExpression; variant: PersonaAvatarVariant }) {
  return <PersonaAvatar {...props} personaId="younghee" />;
}
