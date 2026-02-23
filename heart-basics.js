// Heart tooltips
const heartParts = document.querySelectorAll(".heart-part");
const chamberTooltip = document.getElementById("chamberTooltip");

heartParts.forEach(part => {
  part.addEventListener("mouseover", () => {
    chamberTooltip.innerText = part.dataset.info;
    chamberTooltip.style.display = "block";

    // get the element's position
    const rect = part.getBoundingClientRect();
    const tooltipWidth = chamberTooltip.offsetWidth;
    const tooltipHeight = chamberTooltip.offsetHeight;

    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    let top = rect.top - tooltipHeight - 8; // 8px above the element

    // keep inside viewport
    if (left < 5) left = 5;
    if (left + tooltipWidth > window.innerWidth) left = window.innerWidth - tooltipWidth - 5;
    if (top < 5) top = rect.bottom + 8; // fallback below the element if not enough space

    chamberTooltip.style.left = left + "px";
    chamberTooltip.style.top = top + "px";
  });

  part.addEventListener("mouseout", () => {
    chamberTooltip.style.display = "none";
  });
});
// Blood flow animation
const bloodCell = document.getElementById("bloodCell");
const startBtn = document.getElementById("startBloodFlow");

startBtn.addEventListener("click", () => {
  let keyframes = [
    {top:"55px", left:"85px", background:"#4b79ff"},   // RA
    {top:"215px", left:"85px", background:"#4b79ff"},  // RV
    {top:"-50px", left:"180px", background:"#ff4b5c"}, // Lungs (off-diagram step)
    {top:"55px", left:"315px", background:"#ff4b5c"},  // LA
    {top:"215px", left:"315px", background:"#ff4b5c"}  // LV
  ];

  let i = 0;

  function move() {
    if (i >= keyframes.length) return;
    bloodCell.style.top = keyframes[i].top;
    bloodCell.style.left = keyframes[i].left;
    bloodCell.style.background = keyframes[i].background;
    i++;
    setTimeout(move, 1000);
  }

  move();
});