export interface QueuedTranscript { id: string; previousId: string | null; text: string; questionId: string | null }
// 선행 항목이 아직 확정되지 않은 입력은 반환하지 않는다.
export class TranscriptQueue {
  private known = new Set<string>();
  private seen = new Set<string>();
  private pending = new Map<string, QueuedTranscript>();
  acknowledge(id: string) { this.known.add(id); }
  add(item: QueuedTranscript) { if (this.seen.has(item.id)) return false; this.seen.add(item.id); this.pending.set(item.id, item); return true; }
  take(): QueuedTranscript | undefined {
    const item = [...this.pending.values()].find(x => !x.previousId || this.known.has(x.previousId));
    if (item) { this.pending.delete(item.id); this.known.add(item.id); }
    return item;
  }
  get size() { return this.pending.size; }
  clear() { this.pending.clear(); }
}
