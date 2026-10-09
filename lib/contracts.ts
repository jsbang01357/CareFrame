import { z } from 'zod';
import { fieldIds, PROTOCOL_VERSION, questionField, MAX_ANSWER_TURNS } from '@/data/protocol';
import { isSelectableCpxCatalogId } from '@/data/cpx-catalog';
import { personaIds } from '@/lib/persona';
const id = z.string().min(1).max(120);
export const sexSchema = z.enum(['female', 'male', 'other', 'prefer_not_to_say']);
export const demographicsSchema = z.object({
  age: z.number().int().min(18).max(120).nullable(),
  sex: sexSchema.nullable(),
}).strict();
export const cpxCatalogIdSchema = z.string().min(1).max(120).refine(isSelectableCpxCatalogId, 'CPX topic is not available in the symptom intake');
export const fieldSchema = z.enum(fieldIds as [typeof fieldIds[number], ...typeof fieldIds[number][]]);
export const evidenceSchema = z.object({ turn_id: id, quote: z.string().min(1).max(2000), question_id: id.nullable() }).strict();
export const turnSchema = z.object({
  id, provider_item_id: id.nullable(), previous_item_id: id.nullable(), role: z.enum(['user', 'assistant']),
  origin: z.enum(['voice_transcript', 'typed', 'approved_prompt']), text: z.string().min(1).max(2000), final: z.boolean(),
  prompted_question_id: id.nullable(), replaces_turn_id: id.nullable(), created_at: z.string().datetime(),
}).strict();
export const candidateSchema = z.object({
  field_id: fieldSchema, status: z.enum(['reported', 'denied', 'unknown', 'unclear', 'declined', 'not_assessed']),
  value: z.string().min(1).max(500).nullable(), subject: z.enum(['self', 'other', 'unclear']),
  temporality: z.enum(['current', 'historical', 'unclear']), evidence: z.array(evidenceSchema).max(8),
}).strict();
export const factSchema = candidateSchema.extend({
  verification: z.enum(['unconfirmed_transcript', 'user_confirmed', 'user_corrected', 'not_applicable']), revision: z.number().int().nonnegative(),
});
export const extractionSchema = z.object({ facts: z.array(candidateSchema).max(40), scope_signal: z.enum(['supported', 'unsupported', 'uncertain']), scope_evidence: z.array(evidenceSchema).max(8), needs_rephrase: z.boolean() }).strict();
export const safetySchema = z.object({
  status: z.enum(['not_checked', 'pending_clarification', 'no_configured_trigger', 'escalated']),
  triggered_rule_ids: z.array(id).max(30), supporting_evidence: z.array(evidenceSchema).max(40),
  unchecked_fields: z.array(fieldSchema).max(30), latched: z.boolean(), evaluated_revision: z.number().int().nonnegative(),
}).strict();
const deliverySchema = z.object({ question_id: id, revision: z.number().int().nonnegative(), status: z.enum(['shown', 'playing', 'completed', 'interrupted']) }).strict();
export const stateSchema = z.object({
  schema_version: z.literal('1.3'), protocol_version: z.literal(PROTOCOL_VERSION), session_id: id,
  revision: z.number().int().nonnegative().max(100), demo_only: z.literal(true), persona_id: z.enum(personaIds), demographics: demographicsSchema,
  selected_cpx_id: cpxCatalogIdSchema.nullable(), selected_topic_text: z.string().trim().min(2).max(120).nullable(),
  phase: z.enum(['ready', 'interviewing', 'review', 'finished', 'urgent_stop', 'out_of_scope', 'error_paused']),
  scope: z.enum(['supported', 'unsupported', 'uncertain']), turns: z.array(turnSchema).max(100), processed_turn_ids: z.array(id).max(100),
  facts: z.array(factSchema).length(fieldIds.length), superseded_facts: z.array(factSchema).max(200), contextual_facts: z.array(factSchema).max(200),
  asked_question_ids: z.array(id).max(40), last_question_id: id.nullable(), deliveries: z.array(deliverySchema).max(50),
  clarification_counts: z.record(z.string(), z.number().int().min(0).max(1)), safety: safetySchema,
  accepted_answer_count: z.number().int().nonnegative().max(MAX_ANSWER_TURNS), completion: z.enum(['complete', 'partial', 'not_finished']),
  confirmed_revision: z.number().int().nonnegative().nullable(), stop_reason: z.string().max(100).nullable(),
}).strict().superRefine((s, ctx) => {
  if (s.selected_cpx_id && s.selected_topic_text) ctx.addIssue({ code: 'custom', message: 'Choose a catalog topic or enter a topic, not both' });
  if (new Set(s.facts.map(f => f.field_id)).size !== fieldIds.length) ctx.addIssue({ code: 'custom', message: 'Duplicate field' });
  if (new Set(s.turns.map(t => t.id)).size !== s.turns.length) ctx.addIssue({ code: 'custom', message: 'Duplicate turn' });
  if (s.safety.latched && (!['interviewing','review','finished','urgent_stop','out_of_scope'].includes(s.phase) || s.safety.status !== 'escalated')) ctx.addIssue({ code: 'custom', message: 'Invalid latched state' });
  for (const q of s.asked_question_ids) if (!questionField(q) && q !== 'q_scope') ctx.addIssue({ code: 'custom', message: 'Unknown question' });
});
export const actionSchema = z.object({ kind: z.enum(['ask','clarify','review','urgent_help','out_of_scope','pause','finish']), question_id: id.nullable(), approved_text: z.string().max(1500), summary: z.string().max(1000).nullable(), reason_code: id, speak: z.boolean(), report_available: z.boolean() }).strict();
export const finalSummaryResponseSchema = z.object({ summary: z.string().min(1).max(1000) }).strict();
export const requestSchema = z.object({ request_id: id, event: z.enum(['answer','correct','end','confirm']), expected_revision: z.number().int().nonnegative(), state: stateSchema, utterance: turnSchema.nullable(), target_turn_id: id.nullable() }).strict();
export const responseSchema = z.object({ request_id: id, base_revision: z.number().int().nonnegative(), state: stateSchema, next_action: actionSchema, timing: z.object({ server_ms: z.number().nonnegative() }).strict() }).strict();
export type Turn = z.infer<typeof turnSchema>;
export type Sex = z.infer<typeof sexSchema>;
export type Demographics = z.infer<typeof demographicsSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type Fact = z.infer<typeof factSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type InterviewState = z.infer<typeof stateSchema>;
export type NextAction = z.infer<typeof actionSchema>;
export type TurnRequest = z.infer<typeof requestSchema>;
export type TurnResponse = z.infer<typeof responseSchema>;
