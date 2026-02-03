function checkQuiz() {
  const questions = [
    { type: "radio", name: "q1", correct: "b" },
    { type: "checkbox", name: "q2", correct: ["a", "b"] },
    { type: "text", id: "q3", correct: "aorta" },
    { type: "select", id: "q4", correct: "artery" },
    { type: "radio", name: "q5", correct: "true" }
  ];

  let score = 0;
  let unanswered = [];

  // Clear previous highlights
  document.querySelectorAll("#quizForm input, #quizForm select").forEach(el => {
    el.classList.remove("correct", "wrong", "unanswered");
    if(el.parentElement) el.parentElement.classList.remove("correct", "wrong", "unanswered");
  });
  //Checks the type of each question
  questions.forEach((q, i) => {
    if (q.type === "radio") {
      const selected = document.querySelector(`input[name="${q.name}"]:checked`);
      if (!selected) {
        unanswered.push(i+1);
        document.querySelectorAll(`input[name="${q.name}"]`).forEach(el => el.parentElement.classList.add("unanswered"));
      } else if (selected.value === q.correct) {
        score++;
        selected.parentElement.classList.add("correct");
      } else {
        selected.parentElement.classList.add("wrong");
        document.querySelector(`input[name="${q.name}"][value="${q.correct}"]`)?.parentElement.classList.add("correct");
      }
    } 
    else if (q.type === "checkbox") {
      const checkboxes = Array.from(document.querySelectorAll(`input[name="${q.name}"]`));
      const selected = checkboxes.filter(c => c.checked).map(c => c.value);
      if (selected.length === 0) {
        unanswered.push(i+1);
        checkboxes.forEach(c => c.parentElement.classList.add("unanswered"));
      } else {
        checkboxes.forEach(c => {
          if (q.correct.includes(c.value) && c.checked) c.parentElement.classList.add("correct");
          else if (!q.correct.includes(c.value) && c.checked) c.parentElement.classList.add("wrong");
          else if (q.correct.includes(c.value) && !c.checked) c.parentElement.classList.add("correct");
        });
        if (selected.length === q.correct.length && selected.every(v => q.correct.includes(v))) score++;
      }
    } 
    else if (q.type === "text") {
      const input = document.getElementById(q.id);
      const val = input.value.trim().toLowerCase();
      if (!val) {
        unanswered.push(i+1);
        input.classList.add("unanswered");
      } else if (val === q.correct.toLowerCase()) {
        score++;
        input.classList.add("correct");
      } else input.classList.add("wrong");
    } 
    else if (q.type === "select") {
      const select = document.getElementById(q.id);
      if (!select.value) {
        unanswered.push(i+1);
        select.classList.add("unanswered");
      } else if (select.value === q.correct) {
        score++;
        select.classList.add("correct");
      } else select.classList.add("wrong");
    }
  });

  if (unanswered.length > 0) {
    alert("Please answer all questions before submitting. Unanswered: " + unanswered.join(", "));
    return;
  }

  document.getElementById("result").innerHTML = `You scored <strong>${score}</strong> out of ${questions.length}.`;
}

