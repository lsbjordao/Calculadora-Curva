import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LESSONS,
  checkpointComplete,
  clampStepIndex,
  countCompletedLessonSteps,
  getLesson,
  getLessonCheckpointProgress,
  lessonCheckpoints,
  lessonScene,
  normalizeLessonProgress,
  setLessonCheckpointProgress
} from '../src/lessons.js';

test('lessons expose guided scenes with equations',()=>{
  assert.ok(LESSONS.length>=3);
  const ids=LESSONS.map(lesson=>lesson.id);
  ['inverse-functions','optimization-applications','implicit-regions','riemann-methods','modeling-growth'].forEach(id=>{
    assert.ok(ids.includes(id), 'missing lesson '+id);
  });
  for(const lesson of LESSONS){
    assert.ok(lesson.id);
    assert.ok(lesson.label);
    assert.ok(lesson.steps.length>=2);
    lesson.steps.forEach(step=>{
      const scene=lessonScene(step);
      assert.ok(step.title);
      assert.ok(step.text);
      assert.ok(scene.view);
      assert.ok(scene.equations.length>0);
      scene.equations.forEach(eq=>assert.equal(typeof eq.text,'string'));
      const checkpoints=lessonCheckpoints(step);
      checkpoints.forEach(checkpoint=>{
        assert.ok(checkpoint.prompt);
        assert.ok(checkpoint.success);
        assert.ok(checkpoint.next);
        assert.ok(checkpoint.check);
      });
      assert.ok(checkpoints.length>=2, lesson.id+' / '+step.title+' should guide action and observation');
      assert.equal(checkpoints.at(-1).check.type,'ack');
    });
  }
});

test('getLesson falls back to the first lesson',()=>{
  assert.equal(getLesson('missing').id,LESSONS[0].id);
  assert.equal(getLesson(LESSONS[1].id).id,LESSONS[1].id);
});

test('clampStepIndex keeps navigation in range',()=>{
  const lesson=LESSONS[0];
  assert.equal(clampStepIndex(lesson,-1),0);
  assert.equal(clampStepIndex(lesson,999),lesson.steps.length-1);
  assert.equal(clampStepIndex(lesson,1.8),1);
  assert.equal(clampStepIndex(lesson,'bad'),0);
});

test('lessonScene returns a defensive copy',()=>{
  const step=LESSONS[0].steps[0];
  const a=lessonScene(step);
  const b=lessonScene(step);
  a.view.cx=999;
  a.equations[0].text='changed';
  if(a.equations[0].params) a.equations[0].params.a=999;
  assert.notEqual(b.view.cx,999);
  assert.notEqual(b.equations[0].text,'changed');
});

test('checkpointComplete validates lesson actions',()=>{
  const integral=LESSONS.find(lesson=>lesson.id==='integral-area').steps[1];
  assert.equal(checkpointComplete(integral,[{riemannN:8}]),false);
  assert.equal(checkpointComplete(integral,[{riemannN:16}]),true);
  assert.equal(checkpointComplete(integral,[{riemannN:16,riemannMode:'mid'}],1),false);
  assert.equal(checkpointComplete(integral,[{riemannN:16,riemannMode:'trap'}],1),true);

  const params=LESSONS.find(lesson=>lesson.id==='parameters-transform').steps[0];
  assert.equal(checkpointComplete(params,[{params:{b:0}}]),false);
  assert.equal(checkpointComplete(params,[{params:{b:1}}]),true);
  assert.equal(checkpointComplete(params,[{params:{b:1}}],1),false);
  assert.equal(checkpointComplete(params,[{params:{b:1}}],1,{kind:'ack'}),true);

  const chain=LESSONS.find(lesson=>lesson.id==='derivatives').steps[2];
  assert.equal(checkpointComplete(chain,[{dx:1}]),false);
  assert.equal(checkpointComplete(chain,[{dx:0.5}]),true);

  const optimization=LESSONS.find(lesson=>lesson.id==='optimization-applications').steps[0];
  assert.equal(checkpointComplete(optimization,[{dx:2}]),false);
  assert.equal(checkpointComplete(optimization,[{dx:4}]),true);

  const geometry=LESSONS.find(lesson=>lesson.id==='analytic-geometry').steps[0];
  const dist5={geometry:{segments:[{a:{x:0,y:0},b:{x:3,y:4}}]}};
  const dist10={geometry:{segments:[{a:{x:0,y:0},b:{x:6,y:8}}]}};
  const pointsWithC={geometry:{points:[{label:'A',x:0,y:0},{label:'B',x:6,y:8},{label:'C',x:-2,y:1}]}};
  const distAC={text:'dist: A,C',geometry:{segments:[{a:{x:0,y:0},b:{x:-2,y:1}}]}};
  assert.equal(checkpointComplete(geometry,[{},dist5]),false);
  assert.equal(checkpointComplete(geometry,[{},dist10]),true);
  assert.equal(checkpointComplete(geometry,[pointsWithC,dist10],1),true);
  assert.equal(checkpointComplete(geometry,[pointsWithC,distAC],2),true);

  const matrix=LESSONS.find(lesson=>lesson.id==='linear-algebra').steps[1];
  assert.equal(checkpointComplete(matrix,[{params:{b:0}}]),false);
  assert.equal(checkpointComplete(matrix,[{params:{b:0.5}}]),true);
  assert.equal(checkpointComplete(matrix,[{params:{b:0.5,c:0.5}}],1),true);

  const determinant=LESSONS.find(lesson=>lesson.id==='linear-algebra').steps[2];
  assert.equal(checkpointComplete(determinant,[{geometry:{matrix:{det:2}}}]),false);
  assert.equal(checkpointComplete(determinant,[{geometry:{matrix:{det:0}}}]),true);
  assert.equal(checkpointComplete(determinant,[{geometry:{matrix:{det:-2}}}],1),true);

  const synthetic={
    checkpoint:{check:{type:'all',checks:[
      {type:'function-value',eq:0,x:2,value:2,tol:1e-9},
      {type:'riemann-error',eq:0,target:8,maxError:1e-9}
    ]}}
  };
  assert.equal(checkpointComplete(synthetic,[{fn:x=>x,ia:0,ib:4,riemannN:16,riemannMode:'mid'}]),true);
});

test('lessonCheckpoints normalizes single and multi checkpoint steps',()=>{
  assert.equal(lessonCheckpoints(LESSONS[0].steps[0]).length,2);
  assert.ok(lessonCheckpoints(LESSONS.find(lesson=>lesson.id==='analytic-geometry').steps[0]).length>1);
  assert.deepEqual(lessonCheckpoints({}),[]);
});

test('lesson progress normalizes current and completed checkpoints',()=>{
  const lesson=LESSONS.find(item=>item.id==='analytic-geometry');
  const progress=normalizeLessonProgress({lessonId:lesson.id,stepIndex:0,checkpointIndex:2});
  assert.equal(progress.lessonId,lesson.id);
  assert.equal(progress.stepIndex,0);
  assert.equal(getLessonCheckpointProgress(progress,lesson.id,0),2);
  assert.equal(countCompletedLessonSteps(progress,lesson),0);

  setLessonCheckpointProgress(progress,lesson.id,0,99);
  assert.equal(getLessonCheckpointProgress(progress,lesson.id,0),lessonCheckpoints(lesson.steps[0]).length);
  assert.equal(countCompletedLessonSteps(progress,lesson),1);

  const restored=normalizeLessonProgress({lessonId:lesson.id,stepIndex:99,checkpoints:{[lesson.id]:{0:99,1:1}}});
  assert.equal(restored.stepIndex,lesson.steps.length-1);
  assert.equal(getLessonCheckpointProgress(restored,lesson.id,0),lessonCheckpoints(lesson.steps[0]).length);
  assert.equal(getLessonCheckpointProgress(restored,lesson.id,1),1);
});
