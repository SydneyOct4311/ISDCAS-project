//Dark/Light modes
const toggleButton = document.getElementById("themeToggle");

// Loading saved theme 
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-mode");
  toggleButton.textContent = "Light Mode";
} else {
  toggleButton.textContent = "Dark Mode";
}

// 
toggleButton.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");

  if (document.body.classList.contains("dark-mode")) {
    toggleButton.textContent = "Light Mode";
    localStorage.setItem("theme", "dark"); // save choice
  } else {
    toggleButton.textContent = "Dark Mode";
    localStorage.setItem("theme", "light"); // save choice
  }
});
// Open sidebar button
function openNav() {
        document.getElementById("mySidenav").style.width = "250px";
        document.getElementById("main").style.marginLeft = "250px";
        document.querySelector(".openbtn").style.display = "none";
      }
      function closeNav() {
        document.getElementById("mySidenav").style.width = "0";
        document.getElementById("main").style.marginLeft = "0";
        document.querySelector(".openbtn").style.display = "inline-block";
      }
