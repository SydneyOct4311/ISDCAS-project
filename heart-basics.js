// Heart tooltips
const tooltip = document.getElementById("tooltip");

document.querySelectorAll(".hotspot").forEach(dot => {

    dot.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
        tooltip.textContent = dot.dataset.info;
    });

    dot.addEventListener("mousemove", (e) => {
        tooltip.style.left = `${e.clientX - 300}px`;
        tooltip.style.top = `${e.clientY}px`;
    });

    dot.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });

});
