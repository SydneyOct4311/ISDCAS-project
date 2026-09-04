// intro
const intro = document.getElementById("introScreen");
const toggleButton = document.getElementById("themeToggle");

// body class not inline styles — inline display wud override the media
// queries tht swap the nav links nd the menu btn around at diff widths
intro.addEventListener("click", () => {
  intro.classList.add("fade-out");
  document.body.classList.add("intro-done");
});

// load saved theme
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-mode");
  toggleButton.textContent = "Light Mode";
} else {
  toggleButton.textContent = "Dark Mode";
}

toggleButton.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");

  if (document.body.classList.contains("dark-mode")) {
    toggleButton.textContent = "Light Mode";
    localStorage.setItem("theme", "dark");
  } else {
    toggleButton.textContent = "Dark Mode";
    localStorage.setItem("theme", "light");
  }
});

// sidebar
function openNav() {
  document.getElementById("mySidenav").classList.add("show");
}

function closeNav() {
  document.getElementById("mySidenav").classList.remove("show");
}

// close the drawer after a link is clicked so it doesnt sit over the section
document
  .querySelectorAll("#mySidenav a[href^='#']")
  .forEach((link) => link.addEventListener("click", closeNav));

// nav bar — progress bar + highlighting the section ur in

const progressBar = document.querySelector(".nav-progress-bar");
const navLinks = Array.from(document.querySelectorAll(".site-nav-links a"));

// pair each link with its section, skip any tht dont resolve
const sections = navLinks
  .map((link) => ({ link, section: document.querySelector(link.hash) }))
  .filter((entry) => entry.section);

let navTicking = false;

function updateNav() {
  navTicking = false;
  if (!sections.length) return;

  // progress thru the page (avoid divide by 0 on short pages)
  const scrollable =
    document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? window.scrollY / scrollable : 1;
  progressBar.style.width = `${Math.min(progress, 1) * 100}%`;

  // current section = last one whose top passed the line. the line comes frm
  // scroll-margin-top so anchor jumps nd the highlight always agree
  const line = parseFloat(getComputedStyle(sections[0].section).scrollMarginTop) + 8;
  let current = sections[0];

  sections.forEach((entry) => {
    if (entry.section.getBoundingClientRect().top <= line) current = entry;
  });

  // at the very bottom just highlight the last section
  if (scrollable > 0 && window.scrollY >= scrollable - 2) {
    current = sections[sections.length - 1];
  }

  navLinks.forEach((link) => {
    const active = link === current.link;
    link.classList.toggle("active", active);
    if (active) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function requestNavUpdate() {
  if (navTicking) return;
  navTicking = true;
  requestAnimationFrame(updateNav);
}

window.addEventListener("scroll", requestNavUpdate, { passive: true });
window.addEventListener("resize", requestNavUpdate);
updateNav();

// the 3d viewport open/close/esc stuff lives in src/3d-scene.js
