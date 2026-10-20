// Máquina de estados independente de interface/backend.
export const RIDE_STATUS=Object.freeze({
 REQUESTED:'requested',ACCEPTED:'accepted',ARRIVED:'arrived',
 IN_PROGRESS:'in_progress',COMPLETED:'completed',CANCELLED:'cancelled'
});
const TRANSITIONS=Object.freeze({
 requested:['accepted','cancelled'],
 accepted:['arrived','cancelled'],
 arrived:['in_progress','cancelled'],
 in_progress:['completed'],
 completed:[],
 cancelled:[]
});
export function canTransition(from,to){return (TRANSITIONS[from]||[]).includes(to)}
export function transitionRide(ride,to,actor){
 if(!ride||!canTransition(ride.status,to))throw new Error('Transição de corrida inválida');
 const rider=actor?.id===ride.riderId,driver=actor?.id===ride.driverId;
 const allowed=to==='accepted'?actor?.role==='driver'&&!!actor?.approved:
   to==='cancelled'?(rider||driver):
   (driver&&actor?.role==='driver');
 if(!allowed)throw new Error('Ação não autorizada para esta corrida');
 if(to==='accepted'&&ride.driverId&&ride.driverId!==actor.id)throw new Error('Corrida já aceita por outro motorista');
 return {...ride,status:to,driverId:to==='accepted'?actor.id:ride.driverId};
}
