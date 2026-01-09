import { projects, voices } from "../data/content.js";

const projectsGrid = document.getElementById("projects-grid");
const heroTicker = document.getElementById("hero-ticker");
const impactProjects = document.getElementById("impact-projects");
const impactVoices = document.getElementById("impact-voices");
const voicesGrid = document.getElementById("voices-grid");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderProjects = () => {
  if (!projectsGrid) return;
  projectsGrid.innerHTML = "";
  projects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "project-card";
    card.innerHTML = `
      <span>${project.tag}</span>
      <h4>${project.title}</h4>
      <p>${project.description}</p>
      <span class="project-card__status">${project.status ?? "Prototype"}</span>
      <div class="project-card__links">
        <a href="${project.demo ?? "#"}" target="_blank" rel="noreferrer">Live</a>
        ${project.repo ? `<a href="${project.repo}" target="_blank" rel="noreferrer">Code</a>` : ""}
      </div>
    `;
    projectsGrid.appendChild(card);
  });
};
renderProjects();

const updateImpactStats = () => {
  if (impactProjects) {
    impactProjects.textContent = projects.length.toString();
  }
  if (impactVoices) {
    impactVoices.textContent = voices.length.toString();
  }
};

updateImpactStats();

const renderVoices = () => {
  if (!voicesGrid) return;
  voicesGrid.innerHTML = voices
    .map(
      (voice) => `
        <article class="voice-card">
          <span>+ ${voice.role}</span>
          <strong>${voice.person}</strong>
          <p>${voice.quote}</p>
        </article>
      `
    )
    .join("");
};

renderVoices();

const tickerLines = [
  "Carlos Atalluz — research tooling, bilingual signal, creative dashboards",
  "Mentoring 350+ students with Rust services and Spanish-first notes",
  "Sustainable systems + Cape Town irrigation experiments",
  "Capstone-grade data platforms layered with storytelling",
  "Cross-border scholarship programs connecting Lima and Cal"
];
let tickerIndex = 0;
const updateTicker = () => {
  if (!heroTicker) return;
  heroTicker.textContent = tickerLines[tickerIndex];
  tickerIndex = (tickerIndex + 1) % tickerLines.length;
};

updateTicker();
if (!prefersReducedMotion) {
  setInterval(updateTicker, 4000);
}

const revealElements = document.querySelectorAll(".reveal");
if (revealElements.length && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

const navLinks = document.querySelectorAll(".nav__links a[href^=\"#\"]");
const sectionObserver = ("IntersectionObserver" in window && navLinks.length
  ? new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            navLinks.forEach((link) => {
              link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
            });
          }
        });
      },
      { threshold: 0.45 }
    )
  : null);

if (sectionObserver) {
  document.querySelectorAll("section[id]").forEach((section) => sectionObserver.observe(section));
} else {
  navLinks.forEach((link) => link.classList.add("is-active"));
}
