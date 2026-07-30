"use strict";

// Linear undo/redo over opaque snapshot values (the app uses serialized state
// strings). Pure: holds no DOM or app state, only the past/current/future
// stacks, so it can be unit-tested in isolation.
export function createHistory({limit=100}={}){
  const past=[];
  const future=[];
  let current=null;

  return {
    // Record a new state. Returns false (no-op) when identical to the current
    // one, so callers can skip redundant UI updates.
    commit(snap){
      if(snap===current) return false;
      if(current!==null){
        past.push(current);
        if(past.length>limit) past.shift();
      }
      current=snap;
      future.length=0;
      return true;
    },
    // Step back/forward, returning the state to apply or null when unavailable.
    undo(){
      if(!past.length) return null;
      future.push(current);
      current=past.pop();
      return current;
    },
    redo(){
      if(!future.length) return null;
      past.push(current);
      current=future.pop();
      return current;
    },
    canUndo(){ return past.length>0; },
    canRedo(){ return future.length>0; },
    getCurrent(){ return current; }
  };
}
