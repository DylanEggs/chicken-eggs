(() => {
  "use strict";
  if (window.__FarmPublicChickenRotationV1) return;
  window.__FarmPublicChickenRotationV1 = true;

  const base=window.FarmPublicCustomerBuilderV1;
  const rotation=window.FarmChickenOfDayRotationV1;
  if(!base?.build||!rotation?.pick){
    console.error("Public Chicken of the Day rotation could not start: required builder/rotation missing");
    return;
  }

  const oldBuild=base.build.bind(base);
  window.FarmPublicCustomerBuilderV1={...base,build(input={}){
    const out=oldBuild(input);
    const today=rotation.localDate();
    const chosen=rotation.pick(out?.flock||[],today,input?.deluxe||{});
    if(out?.summary)out.summary.chickenOfTheDayId=chosen?.id||"";
    return out;
  },__noRepeatChickenRotation:true};

  console.log("🔄 Public Chicken of the Day uses the shared no-repeat flock rotation");
})();
