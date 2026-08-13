(() => {
  "use strict";
  const guarded = new Set([
    "bizChickenSummary",
    "bizChickenHistory",
    "farm2CustomerList",
    "farm2OrderList",
    "farm2ExpenseList",
    "farm2FlockList",
    "farm2ChoreList"
  ]);
  const proto = Element.prototype;
  if (proto.__farmIdenticalHtmlGuard) return;
  const desc = Object.getOwnPropertyDescriptor(proto, "innerHTML");
  if (!desc?.get || !desc?.set || !desc.configurable) return;
  Object.defineProperty(proto, "innerHTML", {
    configurable: desc.configurable,
    enumerable: desc.enumerable,
    get: desc.get,
    set(value) {
      const next = String(value ?? "");

      // inventory.js is the only renderer allowed to own the Physical Egg Inventory card.
      // The older farm-consistency layer includes this badge in its competing version.
      if (this?.id === "inventoryDashboardCard" && next.includes('class="farm2-badge gold"')) return;

      if (this?.id && guarded.has(this.id) && desc.get.call(this) === next) return;
      desc.set.call(this, value);
    }
  });
  Object.defineProperty(proto, "__farmIdenticalHtmlGuard", { value:true, configurable:true });
  console.log("✅ Duplicate redraw guard active; Physical Egg Inventory has one renderer");
})();