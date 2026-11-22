// Where the camera goes for a question, by type: one place, two places side by side (size question), or the place
// a border question is about with room around it for its neighbours.
import { itemById } from '../data/gameData';
import type { Question } from '../logic/types';
import { frameItem, neutralCam, WRAP, type Box, type Cam } from '../map/camera';
import { map as M } from '../theme';

/** The place drawn as the purple target. */
export function targetOf(q: Question): string {
  if (q.type === 'borders') return q.subjectId ?? q.itemId;
  if (q.type === 'bigger') return q.options[0];
  return q.itemId;
}

/** The second place drawn: the other side of a size question (orange), or the neighbour shown on a reveal (green). */
export function secondOf(q: Question): string | null {
  if (q.type === 'bigger') return q.options[1];
  if (q.type === 'borders') return q.itemId;
  return null;
}

export function camFor(q: Question, box: Box): Cam {
  if (q.type === 'flag' || q.type === 'name_to_flag') return neutralCam('world');
  if (q.type === 'bigger') {
    const a = itemById(q.options[0]);
    const b = itemById(q.options[1]);
    // b's copy nearest to a (two places either side of the date line)
    const shift = q.scene === 'world' ? Math.round((a.label[0] - b.label[0]) / WRAP) * WRAP : 0;
    const f: [number, number, number, number] = [
      Math.min(a.focus[0], b.focus[0] + shift), Math.min(a.focus[1], b.focus[1]),
      Math.max(a.focus[2], b.focus[2] + shift), Math.max(a.focus[3], b.focus[3]),
    ];
    // both must be seen whole: frame the pair with margin, never closer than for the bigger one alone
    return frameItem({ ...a, focus: f, areaKm2: Infinity }, q.scene, box, M.targetFill * 0.92);
  }
  if (q.type === 'borders') {
    // the place in the middle, with its surroundings in view
    // the place a little smaller than in a map question, so its neighbours show around it (widening a long country
    // like Chile instead would show half the world)
    return frameItem(itemById(q.subjectId ?? q.itemId), q.scene, box, M.targetFill * 0.62);
  }
  return frameItem(itemById(q.itemId), q.scene, box);
}
