/**
 * Cyberpunk RED attack resolution rules: range DV from a weapon's DV table, whether a target dodges,
 * who wins (the defender wins ties), and what a damage roll does. No Foundry globals, so it can be
 * tested with `node --test`.
 */

/** "ranged", "thrown" or "melee" (melee weapons, brawling and martial arts are all opposed checks). */
export function attackKind({ isRanged, weaponType }) {
  if (weaponType === "thrownWeapon") return "thrown";
  return isRanged ? "ranged" : "melee";
}

/**
 * The DV at a distance from a DV table's bands, or null when out of range or unknown. Ranges are
 * whole metres/yards, so the distance is rounded first.
 * @param {{range: [number, number], dv: number|string}[]} bands
 * @param {number} distance
 */
export function rangeDV(bands, distance) {
  if (!Number.isFinite(distance)) return null;
  const d = Math.max(0, Math.round(distance));
  const band = bands.find(b => d >= b.range[0] && d <= b.range[1]);
  const dv = Number(band?.dv);
  return Number.isFinite(dv) ? dv : null;
}

/**
 * Whether a target should dodge a ranged attack with Evasion instead of taking the range DV. Only
 * targets with REF 8 or more may; they do when their average Evasion check (DEX + Evasion + 5.5)
 * beats the DV.
 */
export function shouldDodge({ ref, dex, evasion }, dv) {
  return Number(ref) >= 8 && Number.isFinite(dv) && Number(dex) + Number(evasion) + 5.5 > dv;
}

/** The attack hits only if it beats the defence: the defender wins ties. */
export const hits = (attackTotal, defence) => Number(attackTotal) > Number(defence);

/** "critical" for a natural 10 on the d10, "fumble" for a natural 1, else null. */
export function natural(firstDie) {
  if (firstDie === 10) return "critical";
  if (firstDie === 1) return "fumble";
  return null;
}

/** Two or more 6s on a damage roll is a Critical Injury: 5 bonus damage straight to HP. */
export const criticalInjury = faces => faces.filter(f => f === 6).length >= 2;

/**
 * What a hit does, estimated from the target's armor: melee halves SP (rounded up); a Critical
 * Injury adds 5 that ignores armor; any damage through armor ablates it by 1.
 * @returns {{through: number, stopped: boolean, ablates: boolean, hpAfter: number|null}}
 */
export function damageEffect({ damage, sp = 0, melee = false, crit = false, hp = null }) {
  const effectiveSP = melee ? Math.ceil(sp / 2) : sp;
  const through = Math.max(0, damage - effectiveSP) + (crit ? 5 : 0);
  return {
    through,
    stopped: through === 0,
    ablates: damage - effectiveSP > 0,
    hpAfter: Number.isFinite(hp?.value) ? hp.value - through : null
  };
}

const MODES = {
  single: "a single shot (one round, not a burst)",
  aimed: "a single aimed shot",
  autofire: "autofire: a burst of rounds",
  thrown: "a thrown weapon",
  melee: "a melee attack"
};

/**
 * What the narrator is told about how an attack was made: the fire mode, a natural 10 or 1 on the
 * attack die, and, for ranged attacks, whether the target can dodge (only REF 8 or more can).
 * @param {{mode?: string|null, natural?: string|null, kind?: string|null, canDodge?: boolean}} r
 */
export function attackFacts({ mode, natural, kind, canDodge }) {
  return [
    MODES[mode] ?? "",
    natural === "critical" ? "a critical success: a natural 10 on the attack die" : "",
    natural === "fumble" ? "a fumble: a natural 1 on the attack die" : "",
    (kind === "ranged" || kind === "thrown") && canDodge === false ? "the target can't dodge ranged attacks (REF under 8), so no dodging or sidestepping" : ""
  ].filter(Boolean);
}

/**
 * What a damage roll did, for the narration prompt: the damage and where it landed, a Critical
 * Injury, the armor that took it and how much it stopped (melee halves SP), and how hurt the target is.
 * @param {{total: number, location: string, crit?: boolean, armor?: {name: string, sp: number}|null,
 *   melee?: boolean, through: number, target: string, wounds?: string|null}} hit
 */
export function damageDetail({ total, location, crit = false, armor = null, melee = false, through, target, wounds = null }) {
  const sp = Number(armor?.sp) || 0;
  const stopped = Math.min(total, melee ? Math.ceil(sp / 2) : sp);
  const name = `the ${String(armor?.name ?? "armor").replace(/\s*\((body|head)\)$/i, "")} (SP ${sp}${melee ? ", halved by melee" : ""})`;
  const share = total > 0 ? stopped / total : 0;
  const armorLine = !sp
    ? "no armor there, so all of it gets through"
    : through === 0
      ? `${name} stops all of it`
      : share > 0.6
        ? `${name} stops most of it; only ${through} gets through`
        : share >= 0.4
          ? `${name} stops about half; ${through} gets through`
          : `most of it gets through ${name}: ${through} damage`;
  return [`${total} damage to the ${location}`, crit ? "a Critical Injury (two 6s)" : "", armorLine, wounds ? `${target} is now ${wounds}` : ""].filter(Boolean).join("; ");
}

/** One line describing what an attack was up against, for the chat card and the narration prompt. */
export function resolutionLine({ attacker, weapon, total, defence }) {
  const against = defence.type === "dv" ? `DV ${defence.value}${defence.distance != null ? ` at ${Math.round(defence.distance)} m` : ""}` : `${defence.name}'s Evasion ${defence.value}`;
  return `${attacker}'s ${weapon}: ${total} vs ${against}`;
}
