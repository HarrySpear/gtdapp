import type { Gtd } from '../lib/store'
import { byUrgency } from '../lib/gtd'
import { daysOld } from '../lib/age'
import ActionRow from './ActionRow'

/** Anything left un-chased for a fortnight probably needs chasing. */
const NUDGE_AFTER_DAYS = 14

/**
 * The list of balls in other people's courts, grouped by person so you can
 * clear a whole conversation in one call.
 */
export default function WaitingTab({ gtd }: { gtd: Gtd }) {
  const waiting = gtd.items.filter((i) => i.status === 'waiting')

  const byPerson = new Map<string, typeof waiting>()
  for (const item of waiting) {
    const who = item.waiting_on?.trim() || 'unassigned'
    byPerson.set(who, [...(byPerson.get(who) ?? []), item])
  }
  const people = [...byPerson.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  const stale = waiting.filter((i) => daysOld(i.created_at) >= NUDGE_AFTER_DAYS)

  return (
    <>
      {waiting.length === 0 && (
        <div className="blank">
          <strong>Nobody owes you anything.</strong>
          When you hand something off, open the action's ⋯ menu, put a name in
          "waiting on" and set the date you need it back.
        </div>
      )}

      {stale.length > 0 && (
        <div className="alert">
          <strong>
            {stale.length} handed off over {NUDGE_AFTER_DAYS} days ago.
          </strong>
          Chase them, or accept they are not coming and take the action back.
        </div>
      )}

      {people.map(([who, list]) => (
        <section className="section" key={who}>
          <h2 className="section-head">
            {who} · {list.length}
          </h2>
          <ul className="list">
            {[...list].sort(byUrgency).map((i) => (
              <ActionRow key={i.id} item={i} gtd={gtd} projects={gtd.projects} />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
