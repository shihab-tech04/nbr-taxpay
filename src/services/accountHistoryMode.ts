import {simulationUsers} from '../contracts/paymentSimulationContract';

/** Only a validated SQL-authorized simulator profile may enter private simulation.
 * Missing/invalid profile always falls back to owner-scoped review history. */
export function historyModeForBoundId(id:unknown):'simulation'|'reviews' {
  return typeof id==='string' && (simulationUsers as readonly string[]).includes(id)
    ? 'simulation' : 'reviews';
}
