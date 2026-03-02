// Intro
const intro = document.getElementById("introScreen");
const toggleButton = document.getElementById("themeToggle");
const openBtn = document.querySelector(".openbtn");

intro.addEventListener("click", () => {
  // Fade out intro
  intro.classList.add("fade-out");

  // Show buttons after fade-out transition 
  setTimeout(() => {
    toggleButton.style.display = "inline-block";
    openBtn.style.display = "inline-block";
  }, 0);
});

// Dark/Light mode
// Loading saved theme
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-mode");
  toggleButton.textContent = "Light Mode";
} else {
  toggleButton.textContent = "Dark Mode";
}

// Toggle dark mode
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

// Sidebar functions
function openNav() {
  document.getElementById("mySidenav").classList.add("show");
  openBtn.style.display = "none"; // hide menu button while sidebar is open
}

function closeNav() {
  document.getElementById("mySidenav").classList.remove("show");
  openBtn.style.display = "inline-block"; // show menu button again
}
